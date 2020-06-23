module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2015
  },
  env: {
    node: true,
    es6: true
  },
  extends: [
    'eslint:recommended'
  ],
  rules: {
    // allow paren-less arrow functions
    'arrow-parens': 0,
    // allow async-await
    'generator-star-spacing': 0,
    // allow debugger during development
    'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0,
    'semi': ['error', 'always'],
    'quotes': ['error', 'single'],
    'indent': ['error', 2],
    'space-before-blocks': ['error', 'always'],
    'keyword-spacing': ['error', {before: true, after: true}],
    'no-unused-vars': 'off',
    'no-fallthrough': 'off',
    'no-empty': 'off',
    'no-constant-condition': 'off',
    'no-control-regex': 'off'
  }
};
