const crypto = require('crypto');
const mysql = require('mysql');
const util = require('util');
const fs = require('fs');
const appEnv = require('./app-env');
const options = require('./options');

function generateRandomPass(length) {
  let output = '';
  while (output.length < length) {
    const seed = crypto.randomBytes(length);
    output += seed.toString('base64').replace(/[+=/.]/g, '');
  }
  if (output.length > length) {
    output = output.substring(0, length);
  }
  return output;
}

const targetDbPassword = (() => {
  if (appEnv.DB_PASS) {
    return appEnv.DB_PASS;
  }
  generateRandomPass(16);
})();

const adminDbPool = mysql.createPool({
  connectionLimit: 2,
  host: appEnv.DB_HOST,
  user: appEnv.DB_ADMIN_USER,
  password: appEnv.DB_ADMIN_PASS
});

const targetDbPool = mysql.createPool({
  connectionLimit: 2,
  host: appEnv.DB_HOST,
  user: appEnv.DB_USER,
  database: appEnv.DB_NAME,
  password: targetDbPassword,
  multipleStatements: true
});

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function readStdin() {
  if (process.stdin.isTTY) {
    return Promise.resolve(null);
  }
  const stdinChunkList = [];
  return new Promise((resolve, reject) => {
    process.stdin
      .on('data', (chunk) => {
        stdinChunkList.push(chunk);
      })
      .on('error', e => {
        reject(e);
      })
      .on('end', () => {
        resolve(
          Buffer.concat(stdinChunkList)
            .toString()
        );
      });
  });
}

let exitCode = 0;
readStdin()
  .then(sqlSchema => {
    return Promise.resolve()
      .then(() => new Promise((rootResolve, rootReject) => {
        const createUser = options['create-user'];
        const createDb = options['create-db'];
        const grantPrivileges = options['grant-privileges'];

        if (createUser || createDb) {
          adminDbPool.getConnection((connErr, db) => {
            if (connErr) {
              rootReject(connErr);
              return;
            }
            const connResolve = () => {
              db.release();
              rootResolve();
            };
            const connReject = (e) => {
              db.release();
              rootReject(e);
            };

            Promise.resolve()
              .then(() => (createUser ? util.promisify(db.query.bind(db))(
                'CREATE USER IF NOT EXISTS ?@\'%\' IDENTIFIED BY ?',
                [appEnv.DB_USER, appEnv.DB_PASS]
              ) : Promise.resolve()))
              .catch(e => options['ignore-query-error'] && Promise.resolve() || Promise.reject(e))
              .then(() => (createDb ? util.promisify(db.query.bind(db))(
                `CREATE DATABASE IF NOT EXISTS \`${appEnv.DB_NAME}\``
              ) : Promise.resolve()))
              .catch(e => options['ignore-query-error'] && Promise.resolve() || Promise.reject(e))
              .then(() => (grantPrivileges ? util.promisify(db.query.bind(db))(
                `GRANT ALL PRIVILEGES ON \`${appEnv.DB_NAME}\`.* TO ?@'%'`,
                [appEnv.DB_USER]
              ) : Promise.resolve()))
              .then(connResolve)
              .catch(connReject);
          });
        } else {
          rootResolve();
        }
      }))
      .then(() => {
        const saveDbPasswordDest = options['save-db-password'];
        if (!saveDbPasswordDest) {
          return Promise.resolve();
        }
        return new Promise((resolve, reject) => fs.writeFile(saveDbPasswordDest, targetDbPassword, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }));
      })
      .then(() => new Promise((rootResolve, rootReject) => {
        targetDbPool.getConnection((connErr, db) => {
          if (connErr) {
            rootReject(connErr);
            return ;
          }

          Promise.resolve()
            .then(() => options['sql-file'] ? options['sql-file'].reduce(
              (prev, cur) => {
                return prev
                  .then(() => new Promise((resolve, reject) => {
                    fs.readFile(cur, (err, data) => {
                      if (err) {
                        reject(err);
                        return;
                      }

                      const sqlList = [];
                      let sqlContentBuf = data.toString();
                      let foundDelimiter;
                      do {
                        foundDelimiter = /(^|\s)DELIMITER ([^ \r\n\s]+)/.exec(sqlContentBuf);
                        if (foundDelimiter) {
                          const delimiterText = foundDelimiter[2];
                          sqlList.push(sqlContentBuf.substring(0, foundDelimiter.index));

                          sqlContentBuf = sqlContentBuf.substring(foundDelimiter.index + foundDelimiter[0].length);
                          const foundEnd = new RegExp(`${escapeRegExp(delimiterText)}([\\r\\n\\t ]*;)?([\\r\\n\\t ]*DELIMITER[\\r\\n\\t ]*;)?`).exec(sqlContentBuf);
                          if (!foundEnd) {
                            return Promise.reject(new Error(`Could not find end delimiter: '${delimiterText}'`));
                          }

                          const part = sqlContentBuf.substring(0, foundEnd.index);
                          sqlList.push(part);

                          sqlContentBuf = sqlContentBuf.substring(foundEnd.index + foundEnd[0].length);
                        } else {
                          sqlList.push(sqlContentBuf);
                        }
                      } while (foundDelimiter);

                      const executeQueryPart = (index) => {
                        if (index >= sqlList.length) {
                          resolve();
                          return ;
                        }
                        const sql = sqlList[index];
                        db.query(sql, (err, result) => {
                          if (err) {
                            if (!options['ignore-query-error']) {
                              reject(err);
                              return;
                            }
                          }
                          executeQueryPart(index + 1);
                        });
                      };
                      executeQueryPart(0);
                    });
                  }));
              }, Promise.resolve()
            ) : Promise.resolve())
            .then(() => sqlSchema ? new Promise((resolve, reject) => {
              db.query(sqlSchema, (err, result) => {
                if (err) {
                  if (!options['ignore-query-error']) {
                    reject(err);
                    return;
                  }
                }
                resolve();
              });
            }) : Promise.resolve())
            .then(() => {
              db.release();
              rootResolve();
            })
            .catch(e => {
              db.release();
              rootReject(e);
            });
        });
      }));
  })
  .catch(e => {
    console.error(e);
    exitCode = 2;
  })
  .finally(() => {
    return Promise.all([
      new Promise((resolve, reject) => {
        adminDbPool.end(resolve);
      }),
      new Promise((resolve, reject) => {
        targetDbPool.end(resolve);
      })
    ]);
  })
  .then(() => process.exit(exitCode));
