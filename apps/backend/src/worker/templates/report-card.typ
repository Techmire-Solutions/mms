// MMS Report Card Template (Typst BiDi)
// Language/direction come from the render options (data.json) — never hardcoded — and missing
// values print empty so a card never states an attendance/remark/grade it was not given.
#set page(
  paper: "a4",
  margin: (x: 1.8cm, y: 2.0cm),
  header: align(right)[
    #text(8pt, fill: luma(120))[#datetime.today().display("[year]-[month]-[day]")]
  ]
)

#let doc_data = json("/data.json")
#let lang = doc_data.at("lang", default: "en")
#let is_rtl = doc_data.at("direction", default: "ltr") == "rtl"

#set text(
  font: ("Readex Pro", "Noto Nastaliq Urdu", "Geist", "Liberation Sans"),
  size: 10pt,
  lang: lang,
  dir: if is_rtl { rtl } else { ltr }
)

#let L = if lang == "ar" {
  (
    student: "اسم الطالب",
    roll: "رقم القيد",
    class: "الصف / الحلقة",
    attendance: "نسبة الحضور",
    details: "تفاصيل الدرجات والمواد",
    subject: "المادة",
    maxMarks: "الدرجة الكاملة",
    obtained: "الدرجة المحصلة",
    grade: "التقدير",
    remarks: "ملاحظات",
    total: "المجموع الكلي",
    percentage: "النسبة المئوية",
    finalGrade: "التقدير العام",
    remarksTitle: "ملاحظات وتوجيهات الإدارة / المدرس",
    parent: "توقيع ولي الأمر",
    teacher: "توقيع مدرس الفصل",
    principal: "ختم وتوقيع المدير",
    report: "بطاقة تقييم الأداء والدرجات | Report Card",
    academicYear: "العام الدراسي",
  )
} else {
  (
    student: "Student",
    roll: "Roll No.",
    class: "Class",
    attendance: "Attendance",
    details: "Subject Results",
    subject: "Subject",
    maxMarks: "Max Marks",
    obtained: "Obtained",
    grade: "Grade",
    remarks: "Remarks",
    total: "Total",
    percentage: "Percentage",
    finalGrade: "Final Grade",
    remarksTitle: "Remarks / Teacher Guidance",
    parent: "Parent Signature",
    teacher: "Class Teacher Signature",
    principal: "Principal Seal & Signature",
    report: "Report Card",
    academicYear: "Academic Year",
  )
}

#let content_align = if is_rtl { right } else { left }

#let institution = doc_data.at("institution", default: "Madrasa Management System")
#let student_name = doc_data.at("studentName", default: "")
#let roll_number = doc_data.at("rollNumber", default: "")
#let class_name = doc_data.at("className", default: "")
#let term = doc_data.at("term", default: "")
#let academic_year = doc_data.at("academicYear", default: "")
#let subjects = doc_data.at("subjects", default: ())
#let total_marks = doc_data.at("totalMarks", default: 0)
#let obtained_marks = doc_data.at("obtainedMarks", default: 0)
#let percentage = doc_data.at("percentage", default: "")
#let grade = doc_data.at("grade", default: "-")
#let attendance = doc_data.at("attendance", default: "")
#let remarks = doc_data.at("remarks", default: "")

// Header
#align(center)[
  #block(
    stroke: (bottom: 1.5pt + rgb("#0f172a")),
    inset: (bottom: 12pt),
    width: 100%,
    [
      #text(16pt, weight: "bold", fill: rgb("#0f172a"))[#institution] \
      #v(4pt)
      #text(13pt, weight: "medium", fill: rgb("#334155"))[#L.report] \
      #text(10pt, fill: rgb("#64748b"))[#L.academicYear: #academic_year #if term != "" [· #term]]
    ]
  )
]

#v(10pt)

// Student Info Grid
#table(
  columns: (1fr, 1.5fr, 1fr, 1.5fr),
  stroke: (x, y) => if y == 0 { (bottom: 1pt + rgb("#cbd5e1")) } else { none },
  fill: (col, row) => if calc.even(row) { rgb("#f8fafc") } else { none },
  inset: 7pt,
  [*#L.student:*], [#student_name], [*#L.roll:*], [#roll_number],
  [*#L.class:*], [#class_name], [*#L.attendance:*], [#attendance]
)

#v(14pt)

// Subject Results
#text(11pt, weight: "bold", fill: rgb("#0f172a"))[#L.details]
#v(6pt)

#table(
  columns: (2.5fr, 1fr, 1fr, 1fr, 1.5fr),
  stroke: 0.5pt + rgb("#cbd5e1"),
  fill: (col, row) => if row == 0 { rgb("#0f172a") } else if calc.even(row) { rgb("#f8fafc") } else { none },
  inset: 7pt,
  align: (col, row) => if row == 0 { center } else if col == 0 { content_align } else { center },

  // Header Row
  table.header(
    [#text(fill: white, weight: "bold")[#L.subject]],
    [#text(fill: white, weight: "bold")[#L.maxMarks]],
    [#text(fill: white, weight: "bold")[#L.obtained]],
    [#text(fill: white, weight: "bold")[#L.grade]],
    [#text(fill: white, weight: "bold")[#L.remarks]]
  ),

  ..for item in subjects {
    (
      [#item.at("name", default: "-")],
      [#str(item.at("maxMarks", default: 0))],
      [#str(item.at("obtainedMarks", default: 0))],
      [#item.at("grade", default: "-")],
      [#item.at("remarks", default: "")]
    )
  }
)

#v(10pt)

// Summary Box
#align(content_align)[
  #block(
    width: 50%,
    stroke: 1pt + rgb("#0284c7"),
    radius: 4pt,
    fill: rgb("#f0f9ff"),
    inset: 10pt,
    [
      #grid(
        columns: (1.5fr, 1fr),
        row-gutter: 6pt,
        [*#L.total:*], [#obtained_marks / #total_marks],
        [*#L.percentage:*], [#percentage],
        [*#L.finalGrade:*], [#text(weight: "bold", fill: rgb("#0369a1"))[#grade]]
      )
    ]
  )
]

#v(12pt)

// Remarks & Signatures
#block(
  width: 100%,
  stroke: 0.5pt + rgb("#e2e8f0"),
  radius: 4pt,
  inset: 10pt,
  [
    #text(weight: "bold")[#L.remarksTitle] \
    #v(4pt)
    #text(fill: rgb("#334155"))[#remarks]
  ]
)

#v(25pt)

#grid(
  columns: (1fr, 1fr, 1fr),
  align: center,
  [
    #line(length: 80%, stroke: 0.5pt + rgb("#94a3b8")) \
    #text(9pt, fill: rgb("#64748b"))[#L.parent]
  ],
  [
    #line(length: 80%, stroke: 0.5pt + rgb("#94a3b8")) \
    #text(9pt, fill: rgb("#64748b"))[#L.teacher]
  ],
  [
    #line(length: 80%, stroke: 0.5pt + rgb("#94a3b8")) \
    #text(9pt, fill: rgb("#64748b"))[#L.principal]
  ]
)
