import tseslint from "typescript-eslint";

const typeCurlyNewline = {
  meta: {
    fixable: "whitespace",
    messages: {
      afterOpening: "Place the first type member after the opening brace.",
      beforeClosing: "Place the closing brace after the final type member.",
      betweenMembers: "Place each type member on its own line.",
    },
    schema: [],
    type: "layout",
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      TSTypeLiteral(node) {
        if (node.members.length === 0) return;

        const openingBrace = sourceCode.getFirstToken(node);
        const closingBrace = sourceCode.getLastToken(node);
        const firstMember = node.members[0];
        const lastMember = node.members[node.members.length - 1];

        if (openingBrace.loc.end.line === firstMember.loc.start.line) {
          context.report({
            fix: (fixer) => fixer.insertTextAfter(openingBrace, "\n"),
            messageId: "afterOpening",
            node,
          });
        }

        for (let index = 0; index < node.members.length - 1; index += 1) {
          const member = node.members[index];
          const nextMember = node.members[index + 1];

          if (member.loc.end.line === nextMember.loc.start.line) {
            const nextToken = sourceCode.getTokenAfter(member);
            const insertionPoint =
              nextToken?.value === ";" ? nextToken : member;

            context.report({
              fix: (fixer) => fixer.insertTextAfter(insertionPoint, "\n"),
              messageId: "betweenMembers",
              node: member,
            });
          }
        }

        if (lastMember.loc.end.line === closingBrace.loc.start.line) {
          context.report({
            fix: (fixer) => fixer.insertTextBefore(closingBrace, "\n"),
            messageId: "beforeClosing",
            node,
          });
        }
      },
    };
  },
};

export default [
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/*.d.ts"],
  },
  {
    files: [
      "backend/src/**/*.ts",
      "frontend/src/**/*.ts",
      "frontend/src/**/*.tsx",
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      local: {
        rules: {
          "type-curly-newline": typeCurlyNewline,
        },
      },
    },
    rules: {
      "comma-dangle": ["error", "always-multiline"],
      "comma-spacing": [
        "error",
        {
          after: true,
          before: false,
        },
      ],
      indent: [
        "error",
        2,
        {
          SwitchCase: 1,
        },
      ],
      "local/type-curly-newline": "error",
      "no-trailing-spaces": "error",
      "object-curly-newline": [
        "error",
        {
          ObjectExpression: {
            consistent: true,
            minProperties: 1,
            multiline: true,
          },
          ObjectPattern: {
            consistent: true,
            minProperties: 1,
            multiline: true,
          },
        },
      ],
      "object-property-newline": [
        "error",
        {
          allowAllPropertiesOnSameLine: false,
        },
      ],
    },
  },
];
