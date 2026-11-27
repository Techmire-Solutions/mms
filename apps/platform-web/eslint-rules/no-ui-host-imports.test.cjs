const { RuleTester } = require("eslint");
const rule = require("./no-ui-host-imports.cjs");

const filename = "/repo/src/components/ui/FreshView.tsx";
new RuleTester().run("no-ui-host-imports", rule, {
  valid: [
    { filename, code: "import { Card } from '@/components/ui/card';" },
    {
      filename: "/repo/src/tenant/components/Adapter.tsx",
      code: "import { useUsers } from '@/tenant/hooks/users';",
    },
    {
      filename: "/repo/src/components/ui/FreshView.test.tsx",
      code: "import { useUsers } from '@/tenant/hooks/users';",
    },
  ],
  invalid: [
    {
      filename,
      code: "import { useUsers } from '@/tenant/hooks/users';",
      errors: [{ messageId: "boundary" }],
    },
    {
      filename,
      code: "import { useUsers } from '@/tenant/hooks/users/index';",
      errors: [{ messageId: "boundary" }],
    },
    {
      filename,
      code: "export * from '../../tenant/hooks/users';",
      errors: [{ messageId: "boundary" }],
    },
    {
      filename,
      code: "const load = () => import('@/platform/lib/data');",
      errors: [{ messageId: "boundary" }],
    },
    { filename, code: "const data = require('@/lib/db');", errors: [{ messageId: "boundary" }] },
    {
      filename,
      code: "import { useQuery } from '@tanstack/react-query';",
      errors: [{ messageId: "boundary" }],
    },
  ],
});
