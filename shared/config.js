export const MODES = {
  team: {
    title: "BED HOSPITALITY — Self-Assessment",
    questionsFile: "../data/questions_team.json",
    subheaders: { q1: "STATEMENTS PART ONE", q2: "STATEMENTS PART TWO", done: "SELF-ASSESSMENT SUMMARY" },
    required: { q1: 18, q2: 17 },
    pdfHeading: "SELF-ASSESSMENT REPORT",
    finishText: "Save your self-assessment as PDF."
  },
  peer: {
    title: "BED HOSPITALITY — Peer Review",
    questionsFile: "../data/questions_peer.json",
    subheaders: { q1: "STATEMENTS PART ONE", q2: "STATEMENTS PART TWO", done: "PEER REVIEWER FORM" },
    required: { q1: 18, q2: 17 },
    pdfHeading: "PEER REVIEW REPORT",
    finishText: "Save your peer review as PDF.",
    peerLinkHtml: `<a href="#" target="_blank" style="color:#1E90FF;text-decoration:underline;">send the review form</a>`
  }
};
