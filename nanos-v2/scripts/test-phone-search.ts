import { normalizePhone, matchPhone, getPhoneSearchVariants } from "../src/lib/phone";

interface TestCase {
  description: string;
  input: string;
  expectedNormalized: string;
  shouldMatchCustomerWith: string[]; // Stored formats that this query should match
  shouldNotMatchCustomerWith: string[]; // Stored numbers that this query should NOT match
}

const testCases: TestCase[] = [
  {
    description: "+92 country code with spaces",
    input: "+92 300 1234567",
    expectedNormalized: "03001234567",
    shouldMatchCustomerWith: [
      "03001234567",
      "+92 300 1234567",
      "+923001234567",
      "0300-1234567",
      "923001234567",
      "300 1234567",
      "3001234567",
      "0300 1234567",
    ],
    shouldNotMatchCustomerWith: ["03129999999", "03446993366"],
  },
  {
    description: "Standard local format with dash",
    input: "0300-1234567",
    expectedNormalized: "03001234567",
    shouldMatchCustomerWith: [
      "03001234567",
      "+92 300 1234567",
      "+923001234567",
      "923001234567",
      "300 1234567",
      "0300 1234567",
    ],
    shouldNotMatchCustomerWith: ["03129999999"],
  },
  {
    description: "Standard local 11-digit clean",
    input: "03001234567",
    expectedNormalized: "03001234567",
    shouldMatchCustomerWith: [
      "03001234567",
      "+92 300 1234567",
      "+923001234567",
      "0300-1234567",
      "923001234567",
      "300 1234567",
      "0300 1234567",
    ],
    shouldNotMatchCustomerWith: ["03129999999"],
  },
  {
    description: "92 country code without plus",
    input: "923001234567",
    expectedNormalized: "03001234567",
    shouldMatchCustomerWith: [
      "03001234567",
      "+92 300 1234567",
      "+923001234567",
      "0300-1234567",
      "923001234567",
      "300 1234567",
      "0300 1234567",
    ],
    shouldNotMatchCustomerWith: ["03129999999"],
  },
  {
    description: "10-digit mobile starting with 3 (no leading 0)",
    input: "300 1234567",
    expectedNormalized: "03001234567",
    shouldMatchCustomerWith: [
      "03001234567",
      "+92 300 1234567",
      "+923001234567",
      "0300-1234567",
      "923001234567",
      "300 1234567",
      "0300 1234567",
    ],
    shouldNotMatchCustomerWith: ["03129999999"],
  },
  {
    description: "Partial number (at least 4 digits)",
    input: "0300123",
    expectedNormalized: "0300123",
    shouldMatchCustomerWith: [
      "03001234567",
      "+92 300 1234567",
      "+923001234567",
      "0300-1234567",
      "923001234567",
      "300 1234567",
      "0300 1234567",
    ],
    shouldNotMatchCustomerWith: ["03129999999", "03446993366"],
  },
  {
    description: "Non-matching number",
    input: "0399 9999999",
    expectedNormalized: "03999999999",
    shouldMatchCustomerWith: ["03999999999", "+92 399 9999999"],
    shouldNotMatchCustomerWith: [
      "03001234567",
      "+92 300 1234567",
      "03446993366",
      "0305 9020690",
    ],
  },
  {
    description: "Arbitrary text query (not a phone)",
    input: "non-matching-text",
    expectedNormalized: "",
    shouldMatchCustomerWith: [],
    shouldNotMatchCustomerWith: ["03001234567", "+92 300 1234567"],
  },
];

console.log("=========================================");
console.log("RUNNING PHONE SEARCH NORMALIZATION TESTS");
console.log("=========================================\n");

let passed = 0;
let total = 0;

for (const tc of testCases) {
  console.log(`Test: [${tc.input}] - ${tc.description}`);
  total++;
  const actualNorm = normalizePhone(tc.input);
  if (actualNorm !== tc.expectedNormalized) {
    console.error(
      `  ❌ FAIL normalizePhone: expected "${tc.expectedNormalized}", got "${actualNorm}"`
    );
    continue;
  } else {
    console.log(`  ✓ normalizePhone -> "${actualNorm}"`);
  }

  // Check matching against expected customer phone formats
  let matchFails = 0;
  for (const stored of tc.shouldMatchCustomerWith) {
    total++;
    const matched = matchPhone(stored, tc.input);
    if (!matched) {
      console.error(
        `  ❌ FAIL matchPhone: query "${tc.input}" should match stored "${stored}"`
      );
      matchFails++;
    } else {
      passed++;
    }
  }

  // Check non-matching against unrelated customer numbers
  for (const nonStored of tc.shouldNotMatchCustomerWith) {
    total++;
    const matched = matchPhone(nonStored, tc.input);
    if (matched) {
      console.error(
        `  ❌ FAIL matchPhone: query "${tc.input}" should NOT match stored "${nonStored}"`
      );
      matchFails++;
    } else {
      passed++;
    }
  }

  if (matchFails === 0) {
    passed++;
    console.log(`  ✓ All positive & negative matches passed!`);
  }
  console.log("");
}

console.log("=========================================");
console.log(`RESULTS: ${passed}/${total} assertions passed.`);
console.log("=========================================");

if (passed !== total) {
  process.exit(1);
}
