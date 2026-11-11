// MMS Financial Ledger Template (Typst BiDi)
#let doc_data = json("/data.json")
#let lang = doc_data.at("lang", default: "en")
#let is_rtl = doc_data.at("direction", default: "ltr") == "rtl"
#set page(
  paper: "a4",
  margin: (x: 1.5cm, y: 1.5cm),
  header: align(right)[
    #text(8pt, fill: luma(120))[تقرير دفتر الأستاذ المحاسبي | General Ledger Summary]
  ],
  footer: [
    #align(center)[#text(8pt, fill: luma(100))[صفحة #counter(page).display()]]
  ]
)

#set text(
  font: ("Readex Pro", "Noto Nastaliq Urdu", "Geist", "Liberation Sans"),
  size: 8.5pt,
  lang: lang,
  dir: if is_rtl { rtl } else { ltr }
)


#let institution = doc_data.at("institution", default: "Madrasa Management System")
#let period = doc_data.at("period", default: "الفترة المالية الحالية")
#let currency = doc_data.at("currency", default: "USD")
#let entries = doc_data.at("entries", default: ())
#let total_debit = doc_data.at("totalDebit", default: "0.00")
#let total_credit = doc_data.at("totalCredit", default: "0.00")
#let net_balance = doc_data.at("netBalance", default: "0.00")

// Header
#align(center)[
  #text(15pt, weight: "bold", fill: rgb("#0f172a"))[#institution] \
  #text(11pt, weight: "medium", fill: rgb("#0f766e"))[كشف القيود المحاسبية ودفتر الأستاذ العام | General Ledger Statement] \
  #text(9pt, fill: rgb("#64748b"))[الفترة: #period | العملة: #currency]
]

#v(8pt)

// Table of Ledger Entries
#table(
  columns: (1.5fr, 1.8fr, 3.5fr, 1.5fr, 1.5fr, 1.5fr),
  stroke: 0.5pt + rgb("#cbd5e1"),
  fill: (col, row) => if row == 0 { rgb("#0f766e") } else if calc.even(row) { rgb("#f8fafc") } else { none },
  inset: 5pt,
  align: (col, row) => if row == 0 { center } else if col == 2 { right } else { center },
  
  table.header(
    [#text(fill: white, weight: "bold")[التاريخ]],
    [#text(fill: white, weight: "bold")[رقم الحساب / المرجع]],
    [#text(fill: white, weight: "bold")[البيان والشرح]],
    [#text(fill: white, weight: "bold")[مدين (Debit)]],
    [#text(fill: white, weight: "bold")[دائن (Credit)]],
    [#text(fill: white, weight: "bold")[الرصيد]]
  ),

  ..for entry in entries {
    (
      [#entry.at("date", default: "-")],
      [#entry.at("accountCode", default: "-")],
      [#entry.at("description", default: "-")],
      [#entry.at("debit", default: "-")],
      [#entry.at("credit", default: "-")],
      [#entry.at("balance", default: "-")]
    )
  }
)

#v(8pt)

// Ledger totals
#align(left)[
  #block(
    width: 40%,
    stroke: 1pt + rgb("#0f766e"),
    fill: rgb("#f0fdf4"),
    radius: 3pt,
    inset: 7pt,
    [
      #grid(
        columns: (1fr, 1fr),
        row-gutter: 4pt,
        [*إجمالي المدين:*], [#total_debit #currency],
        [*إجمالي الدائن:*], [#total_credit #currency],
        [*صافي الرصيد:*], [#text(weight: "bold", fill: rgb("#047857"))[#net_balance #currency]]
      )
    ]
  )
]
