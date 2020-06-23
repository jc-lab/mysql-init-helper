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

function readStdin() {
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
        console.log(options);

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
      .then(() => new Promise((resolve, reject) => {
        targetDbPool.getConnection((connErr, db) => {
          if (connErr) {
            reject(connErr);
            return ;
          }

          const connResolve = () => {
            db.release();
            resolve();
          };
          const connReject = (e) => {
            db.release();
            reject(e);
          };

          db.query(sqlSchema, (err, result) => {
            if (err) {
              if (!options['ignore-query-error']) {
                connReject(err);
                return ;
              }
            }
            connResolve();
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
