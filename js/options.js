// The six answer options, in the exact display order (2 columns x 3 rows):
// Yes | Yes (fantasy)
// Open | Open (fantasy)
// No | Never
export const ANSWER_OPTIONS = [
  { code: "YR",    label: "Yes",            sublabel: "I want this IRL!",                              tier: "yes"   },
  { code: "YF",    label: "Yes (fantasy)",  sublabel: "I want this, but only as a fantasy \u2014 no IRL.", tier: "yes"   },
  { code: "OR",    label: "Open",           sublabel: "I'm neutral-to-positive on trying this IRL.",   tier: "open"  },
  { code: "OF",    label: "Open (fantasy)", sublabel: "Neutral-to-positive on this as a fantasy only.", tier: "open"  },
  { code: "No",    label: "No",             sublabel: "Not interested.",                                tier: "no"    },
  { code: "Never", label: "Never",          sublabel: "This is a major line for me.",                   tier: "never" },
];

export function optionByCode(code) {
  return ANSWER_OPTIONS.find((o) => o.code === code);
}
