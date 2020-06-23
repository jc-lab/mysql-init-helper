const NO_VALUE  = 0;
const REQUIRE_VALUE = 1;
const OPTIONAL_VALUE = 2;

const REGEX_IS_TRUE = /true|yes|1/i;
const REGEX_IS_FALSE = /false|no|0/i;

const OPTIONS = {
  'create-user': {
    hasValue: OPTIONAL_VALUE,
    transform: (v) => {
      if (!v) {
        return true;
      }
      return REGEX_IS_TRUE.test(v);
    },
    defaultValue: false
  },
  'create-db': {
    hasValue: OPTIONAL_VALUE,
    transform: (v) => {
      if (!v) {
        return true;
      }
      return REGEX_IS_TRUE.test(v);
    },
    defaultValue: false
  },
  'grant-privileges': {
    hasValue: OPTIONAL_VALUE,
    transform: (v) => {
      if (!v) {
        return true;
      }
      return REGEX_IS_TRUE.test(v);
    },
    defaultValue: false
  },
  'ignore-query-error': {
    hasValue: OPTIONAL_VALUE,
    transform: (v) => {
      if (!v) {
        return true;
      }
      return REGEX_IS_TRUE.test(v);
    },
    defaultValue: false
  },
  'save-db-password': {
    hasValue: REQUIRE_VALUE,
    defaultValue: false
  }
};


const parsedOptions = {};
function parseArgs() {
  for (let i = 0; i < process.argv.length; i++) {
    const current = process.argv[i];
    if (current.startsWith('--')) {
      let [optName, optValue] = current.substr(2).split('=', 2);
      const optionDefine = OPTIONS[optName.toLowerCase()];
      if (!optionDefine) {
        console.error('Unknown option: ' + optName);
        process.exit(1);
      }
      if (optionDefine.hasValue) {
        if (typeof optValue === 'undefined') {
          if ((i + 1) < process.argv.length) {
            optValue = process.argv[i + 1];
            if (optValue.startsWith('--')) {
              optValue = undefined;
            }
          }
          if (typeof optValue === 'undefined' && optionDefine.hasValue === REQUIRE_VALUE) {
            console.error('Need value option: ' + optName);
            process.exit(1);
          }
        }
      }
      if (optionDefine.transform) {
        optValue = optionDefine.transform(optValue);
      }
      parsedOptions[optName] = optValue;
    }
  }
  Object.keys(OPTIONS)
    .forEach(key => {
      if (typeof parsedOptions[key] === 'undefined') {
        parsedOptions[key] = OPTIONS[key].defaultValue;
      }
    });
}
parseArgs();

module.exports = parsedOptions;

