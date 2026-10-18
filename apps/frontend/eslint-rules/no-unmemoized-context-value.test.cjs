const { RuleTester } = require("eslint");
const rule = require("./no-unmemoized-context-value.cjs");

new RuleTester({
  languageOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
}).run("no-unmemoized-context-value", rule, {
  valid: [
    { code: "const v = useMemo(() => ({ a }), [a]); <Ctx.Provider value={v} />;" },
    { code: "<Ctx.Provider value={stable} />;" },
    // Consumer is not a Provider — the rule only polices provider values.
    { code: "<Ctx.Consumer value={{ a }} />;" },
    // A plain DOM element attribute named `value` is not a context value.
    { code: "<input value={{}} />;" },
  ],
  invalid: [
    {
      code: "<Ctx.Provider value={{ a, b }} />;",
      errors: [{ messageId: "inlineValue" }],
    },
    {
      code: "<FormFieldContext.Provider value={{ name }}><Controller /></FormFieldContext.Provider>;",
      errors: [{ messageId: "inlineValue" }],
    },
  ],
});
