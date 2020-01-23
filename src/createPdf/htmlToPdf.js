import * as jsPDF from "jspdf";
import parser from "../ResumeParser";
import "jspdf-autotable";

//colors
const color = {
  DARK_GREY: "#212529",
  LIGHT_GREY: "#adb5bd",
  BLUE: "#16a1b9"
};

//fonts
const font = {
  REGULAR: "times"
};

//render one line of text to pdf with given properties of chunks which make up the line. Font size and font style should be set before the function gets called, otherwise the last set font size will be taken.
const renderTextLine = (
  doc,
  props,
  y,
  margins,
  halign,
  delim = " ",
  delimColor = color.DARK_GREY
) => {
  const chunks = props.map(prop => {
    let { contents, fontColor } = prop;
    if (typeof contents == "undefined") return y;
    if (typeof fontColor == "undefined") fontColor = color.DARK_GREY;
    return {
      contents: contents,
      fontColor: fontColor,
      width: doc.getTextWidth(prop.contents)
    };
  });

  const widths = chunks.map(chunk => chunk.width);
  const textWidth = widths.reduce(
    (total, val) => total + val,
    doc.getTextWidth(" ") * (widths.length - 1)
  );
  //horizontal alignment
  let xOffset = margins.left; //default, left
  if (halign === "center") {
    xOffset = doc.internal.pageSize.width / 2 - textWidth / 2;
  } else if (halign === "right") {
    xOffset = doc.internal.pageSize.width - margins.left - textWidth;
  }

  const lineHeight = doc.getFontSize() * doc.getLineHeightFactor();

  chunks.forEach((chunk, index) => {
    doc
      .setTextColor(chunk.fontColor)
      .setFontStyle("normal")
      .text(xOffset, y, chunk.contents);
    if (index < chunks.length - 1) {
      xOffset += chunk.width;
      doc
        .setTextColor(delimColor)
        .setFontStyle("bold")
        .text(xOffset, y, delim);
      xOffset += doc.getTextWidth(delim);
    }
  });
  return y + lineHeight;
};

//render text to pdf with given properties, takes care about adding the new page while keeping the text on the same page
const renderText = (doc, props, x, y, margins) => {
  const chunks = props.map(prop => {
    let {
      contents,
      fontType,
      fontStyle,
      fontSize,
      fontColor,
      marginBottom
    } = prop;
    if (typeof contents == "undefined") return y;
    if (typeof fontType == "undefined") fontType = font.REGULAR;
    if (typeof fontStyle == "undefined") fontStyle = "normal";
    if (typeof fontSize == "undefined") fontSize = doc.getFontSize();
    if (typeof fontColor == "undefined") fontColor = color.DARK_GREY;
    if (typeof marginBottom == "undefined") marginBottom = 0;

    const lines = doc.splitTextToSize(contents, margins.width, {
      fontSize: fontSize
    });
    const lineHeight = fontSize * doc.getLineHeightFactor();
    return {
      lines: lines,
      height: lineHeight * lines.length + marginBottom,
      fontType: fontType,
      fontStyle: fontStyle,
      fontSize: fontSize,
      fontColor: fontColor
    };
  });
  const heights = chunks.map(chunk => chunk.height);
  const totalHeight = heights.reduce((total, val) => total + val, 0);

  if (
    y + totalHeight + 10 >
    doc.internal.pageSize.getHeight() - margins.bottom
  ) {
    doc.addPage();
    y = margins.top;
  }

  chunks.forEach(chunk => {
    doc
      .setFont(chunk.fontType, chunk.fontStyle)
      .setFontSize(chunk.fontSize)
      .setTextColor(chunk.fontColor)
      .text(x, y, chunk.lines);
    y += chunk.height;
  });
  return y;
};

const renderFooter = (doc, margins, contents) => {
  const pageCount = doc.internal.getNumberOfPages();
  doc.setFontSize(10).setTextColor(color.LIGHT_GREY);
  for (let i = 1; i <= pageCount; i++) {
    const startX = margins.left;
    const endX = startX + margins.width;
    const y = doc.internal.pageSize.getHeight() - margins.bottom;

    doc.line(startX, y, margins.left + margins.width, y); // draw a line

    const pageLabel = `Page ${i} of ${pageCount}`;
    endX -= doc.getTextWidth(pageLabel);
    y += margins.bottom / 2;
    doc.setPage(i);
    doc.text(startX, y, contents);
    doc.text(endX, y, pageLabel);
  }
};

const insertTitle = title => {
  const props = [];
  props.push({
    contents: title,
    fontSize: 16,
    fontColor: color.BLUE,
    marginBottom: 10
  });
  return props;
};

$("#pdf-icon").on("click", () => {
  const pdf = new jsPDF("p", "pt", "a4");
  pdf.setFontSize(12);
  pdf.setFont(font.REGULAR, "normal");
  let finalY = 0;
  const margins = {
    top: 80,
    bottom: 50,
    left: 40,
    width: pdf.internal.pageSize.getWidth() - 2 * 40
  };
  console.log(pdf);
  console.log(pdf.getFontList());
  const props = [];

  const name = parser.parseName();
  const firstName = parser.getFirstName().toUpperCase();
  const lastName = parser.getLastName().toUpperCase();
  props.push(
    { contents: firstName, fontColor: color.BLUE },
    { contents: lastName }
  );
  pdf.setFontSize(26);
  finalY = renderTextLine(pdf, props, 50, margins, "center");

  pdf.setFontSize(12);

  props.length = 0;
  props.push({ contents: parser.getEmail() });
  props.push({ contents: `${parser.getAddress()}, ${parser.getCity()}` });
  props.push({ contents: parser.getPhone() });

  finalY = renderTextLine(
    pdf,
    props,
    finalY,
    margins,
    "center",
    " | ",
    color.BLUE
  );

  props.length = 0;
  const profiles = parser.parseProfiles();
  const linkedIn = profiles.find(profile => profile["network"] === "linkedin")
    .url;
  const github = profiles.find(profile => profile["network"] === "github").url;
  props.push({ contents: `LinkedIn: ${linkedIn}` });
  props.push({ contents: `Github: ${github}` });
  finalY = renderTextLine(
    pdf,
    props,
    finalY,
    margins,
    "center",
    " | ",
    color.BLUE
  );

  props.length = 0;
  props.push({ contents: `Portfolio: ${parser.getWebsite()}` });
  finalY = renderTextLine(pdf, props, finalY, margins, "center");

  props.length = 0;
  props.push(...insertTitle("SUMMARY"));
  props.push({
    contents: parser.parseSummary(),
    fontSize: 12,
    marginBottom: 5
  });
  const summaryMargins = { ...margins, width: margins.width / 2 - 20 };
  const finalYSummary = renderText(
    pdf,
    props,
    margins.left,
    finalY + 40,
    summaryMargins
  );

  props.length = 0;

  props.push(...insertTitle("PROFESSIONAL SKILLS"));

  const startYSkills = renderText(
    pdf,
    props,
    margins.width / 2 + 50,
    finalY + 40,
    margins
  );

  let columns = [];
  let rows = [];
  const skills = parser.parseSkills();
  $.each(skills, (columnIndex, skill) => {
    columns.push(skill.name.toUpperCase());
    $.each(skill.keywords, (rowIndex, keyword) => {
      if (!rows[rowIndex]) rows[rowIndex] = [];
      rows[rowIndex][columnIndex] = keyword;
    });
  });

  pdf.autoTable({
    head: [columns],
    body: rows,
    startY: startYSkills - 10,
    margin: { left: margins.width / 2 + 50 },
    headStyles: {
      font: font.REGULAR,
      fontStyle: "bold",
      fontSize: 9,
      textColor: [255, 255, 255],
      fillColor: [22, 161, 185],
      halign: "center",
      lineWidth: 1,
      lineColor: [248, 249, 250]
    },
    styles: {
      font: font.REGULAR,
      fontSize: 10,
      fontStyle: "normal",
      cellPadding: { top: 3, right: 5, bottom: 3, left: 10 },
      fillColor: [248, 249, 250],
      fontSize: 9,
      textColor: [0, 0, 0]
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250]
    }
  });

  const finalYSkills = pdf.previousAutoTable.finalY;
  finalY = finalYSummary > finalYSkills ? finalYSummary : finalYSkills;

  const jobs = parser.parseWorkExperience();
  $.each(jobs, (index, job) => {
    props.length = 0;
    if (index == 0) {
      props.push(...insertTitle("EXPERIENCE"));
    }
    props.push({
      contents: job.company,
      fontSize: 12,
      fontStyle: "bold"
    });
    props.push({ contents: job.position, fontSize: 12 });
    props.push({
      contents: `${job.startDate} - ${job.endDate}`,
      fontSize: 10,
      marginBottom: 5
    });
    const highlights = job.highlights;
    highlights.forEach((highlight, i) =>
      props.push({
        contents: highlight,
        fontSize: 12,
        marginBottom:
          index == jobs.length - 1 ? 0 : i < highlights.length - 1 ? 0 : 10
      })
    );
    const startY = index > 0 ? finalY : finalY + 40;
    finalY = renderText(pdf, props, margins.left, startY, margins);
  });

  //education
  const education = parser.parseEducation();
  props.length = 0;
  props.push(...insertTitle("EDUCATION"));
  $.each(education, (index, edu) => {
    props.push({
      contents: `${edu.institution}, ${edu.area}`,
      fontSize: 12,
      fontStyle: "bold"
    });
    props.push({
      contents: edu.studyType,
      fontSize: 12,
      marginBottom: index == education.length - 1 ? 0 : 5
    });
  });
  finalY = renderText(pdf, props, margins.left, finalY + 30, margins);

  //certificates
  const certificates = parser.parseCertificates();
  props.length = 0;
  props.push(...insertTitle("CERTIFICATES"));
  $.each(certificates, (index, cert) => {
    props.push({
      contents: cert.title,
      fontSize: 12,
      fontStyle: "bold",
      marginBottom: index == certificates.length - 1 ? 0 : 5
    });
  });
  finalY = renderText(pdf, props, margins.left, finalY + 30, margins);

  //LANGUAGES
  const languages = parser.parseLanguages();
  props.length = 0;
  props.push(...insertTitle("LANGUAGES"));
  $.each(languages, (index, lang) => {
    props.push({
      contents: lang.language,
      fontSize: 12,
      fontStyle: "bold"
    });
    props.push({
      contents: lang.fluency,
      marginBottom: index == languages.length - 1 ? 0 : 5
    });
  });
  finalY = renderText(pdf, props, margins.left, finalY + 30, margins);

  renderFooter(pdf, margins, name);

  pdf.save(`${name.replace(/ /g, "")}-CV.pdf`);
});
