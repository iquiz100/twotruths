// The six answer options, in the exact display order (2 columns x 3 rows):
// Yes | Yes (fantasy)
// Open | Open (fantasy)
// No | Never
export const ANSWER_OPTIONS = [
  { code: "YR",    label: "Yes",            tier: "yes"   },
  { code: "YF",    label: "Yes (fantasy)",  tier: "yes"   },
  { code: "OR",    label: "Open",           tier: "open"  },
  { code: "OF",    label: "Open (fantasy)", tier: "open"  },
  { code: "No",    label: "No",             tier: "no"    },
  { code: "Never", label: "Never",          tier: "never" },
];

export function optionByCode(code) {
  return ANSWER_OPTIONS.find((o) => o.code === code);
}
