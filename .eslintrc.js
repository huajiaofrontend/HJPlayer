module.exports = {
    extends: 'airbnb',
    env: {
        browser: true,
        node: true,
    },
    parser: '@typescript-eslint/parser',
    plugins: [
        'typescript',
        "@typescript-eslint"
    ],
    rules: {
        'global-require': 'off',
        'import/no-extraneous-dependencies': 'off',
        'import/no-unresolved': [2, {ignore: ['NavigatorNavigationBar']}],
        'linebreak-style': ['error', 'unix'],
        'class-methods-use-this': 'off', // class no this 不需要加static
        'max-len': 'off', // 单行长度限制
        'no-unused-expressions': ['error', {allowShortCircuit: true}],
        // "no-multi-spaces": "off", // 空格
        'no-bitwise': [2, {allow: ['~', '|']}],
        'import/no-unresolved': 'off',
        'import/extensions': 'off',
        'no-new': ['off'], // 禁止使用 new 以避免产生副作用
        'no-param-reassign': 'off', // 禁止对 function 的参数进行重新赋值
        indent: [2, 4], //  缩进4个空格
        'consistent-return': 'off', // function 必须使用一致的return
        'no-continue': 'off', // 禁用 continue
        'no-restricted-syntax': 'off', // 禁用特殊语法
        'no-control-regex': 'off',
        'comma-dangle': 'off', // 拖尾符
        'no-mixed-operators': 'off', // 禁止混合使用不同的操作符
        'no-console': 'off', // 禁用 console
        'no-shadow': 'off', // 禁止变量声明与外层作用域的变量同名
        'no-plusplus': 'off', // 一元操作符
        'import/no-extraneous-dependencies': 'off', // 允许引入package.json dependencies 中未加入的资源
        'import/no-cycle': 'off', // 暂时忽略live-room中模块循环引用的问题
        'keyword-spacing': [
            'error',
            {
                overrides: {
                    if: {after: false},
                    for: {after: false},
                    while: {after: false},
                    switch: {after: false},
                },
            },
        ],
        'typescript/class-name-casing': 'error',
        'no-underscore-dangle': 'off',
        "no-unused-vars" : "off", // 未被使用的变量, 因为ts的interface和type 而关闭
        "no-bitwise": "off", // 位运算, 因为解码中有很多地方都用到位运算, 所以关闭
        "prefer-destructuring": ["error", {
            "array": false,
            "object": true
          }, {
            "enforceForRenamedProperties": false
        }], // 解构赋值只适用对象
        "max-classes-per-file": "off", // 每个文件最大 class 定义数目,
        "no-useless-constructor": "off", // 无用的constructor, 有问题, 即使需要传递参数也会报这个错误
        "@typescript-eslint/no-unused-vars": 'off',
        "no-lonely-if": 'off',
        "no-undef": "off",
    },
};
