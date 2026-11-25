// MMS Fee Receipt Template (Typst BiDi)
#let doc_data = json("/data.json")
#let lang = doc_data.at("lang", default: "en")
#let is_rtl = doc_data.at("direction", default: "ltr") == "rtl"
#set page(
  paper: "a5",
  margin: (x: 1.5cm, y: 1.5cm)
)

#set text(
  font: ("Readex Pro", "Noto Nastaliq Urdu", "Geist", "Liberation Sans"),
  size: 9pt,
  lang: lang,
  dir: if is_rtl { rtl } else { ltr }
)


#let institution = doc_data.at("institution", default: "Madrasa Management System")
#let receipt_no = doc_data.at("receiptNo", default: "REC-0000")
#let date = doc_data.at("date", default: datetime.today().display("[year]-[month]-[day]"))
#let student_name = doc_data.at("studentName", default: "-")
#let roll_no = doc_data.at("rollNo", default: "-")
#let class_name = doc_data.at("className", default: "-")
#let fee_items = doc_data.at("feeItems", default: ())
#let total_amount = doc_data.at("totalAmount", default: "0.00")
#let paid_amount = doc_data.at("paidAmount", default: "0.00")
#let balance = doc_data.at("balance", default: "0.00")
#let payment_method = doc_data.at("paymentMethod", default: "نقداً / Cash")
#let transaction_ref = doc_data.at("transactionRef", default: "-")

// Header
#grid(
  columns: (2fr, 1fr),
  [
    #text(14pt, weight: "bold", fill: rgb("#0f172a"))[#institution] \
    #text(11pt, weight: "medium", fill: rgb("#0369a1"))[سند قبض رسوم دراسية | Fee Payment Receipt]
  ],
  align(left)[
    #text(9pt)[*رقم السند:* #text(weight: "bold", fill: rgb("#dc2626"))[#receipt_no]] \
    #text(9pt)[*التاريخ:* #date]
  ]
)

#line(length: 100%, stroke: 1pt + rgb("#0284c7"))
#v(6pt)

// Student info
#grid(
  columns: (1fr, 1.5fr, 1fr, 1.5fr),
  row-gutter: 4pt,
  [*اسم الطالب:*], [#student_name], [*رقم القيد:*], [#roll_no],
  [*الصف / المرحلة:*], [#class_name], [*طريقة الدفع:*], [#payment_method]
)

#v(8pt)

// Fee items table
#table(
  columns: (3fr, 1.5fr, 1.5fr),
  stroke: 0.5pt + rgb("#cbd5e1"),
  fill: (col, row) => if row == 0 { rgb("#f1f5f9") } else { none },
  inset: 6pt,
  align: (col, row) => if col == 0 { right } else { center },
  
  table.header(
    [*بيان الرسوم / Item Description*],
    [*المبلغ المستحق*],
    [*المبلغ المدفوع*]
  ),

  ..for item in fee_items {
    (
      [#item.at("description", default: "-")],
      [#item.at("amount", default: "0.00")],
      [#item.at("paid", default: "0.00")]
    )
  }
)

#v(6pt)

// Totals & Settlement
#grid(
  columns: (1.5fr, 1fr),
  [
    #text(8pt, fill: rgb("#64748b"))[رقم العملية / المرجع: #transaction_ref] \
    #v(14pt)
    #text(8pt)[ختم الحسابات / المحاسب: .......................................]
  ],
  [
    #block(
      stroke: 0.5pt + rgb("#cbd5e1"),
      radius: 3pt,
      inset: 6pt,
      fill: rgb("#f8fafc"),
      [
        #grid(
          columns: (1fr, 1fr),
          row-gutter: 3pt,
          [*الإجمالي:*], [#total_amount],
          [*المدفوع:*], [#paid_amount],
          [*المتبقي:*], [#text(weight: "bold", fill: if balance == "0.00" { rgb("#16a34a") } else { rgb("#dc2626") })[#balance]]
        )
      ]
    )
  ]
)
