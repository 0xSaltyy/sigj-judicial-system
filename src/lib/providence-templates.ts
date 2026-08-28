export const templates: Record<string, string> = {
  "Procedural Order": "# PROCEDURAL ORDER\n\n**Case Number:** {{case_number}}  \n**Docket Number:** {{docket_number}}  \n**Federal Court:** {{court}}\n\n## Background\n[Relevant background]\n\n## Findings\n[Reasons for the order]\n\n## Order\n**FIRST.** [Order]\n\n**SECOND.** [Supplemental order]",
  "Memorandum Opinion and Order": "# MEMORANDUM OPINION AND ORDER\n\n**Case Number:** {{case_number}}  \n**Federal Court:** {{court}}\n\n## Background\n[Background]\n\n## Discussion\n[Analysis]\n\n## Conclusion\n[Disposition]",
  "Hearing Minutes": "# HEARING MINUTES\n\n**Date and time:** {{date}}  \n**Case Number:** {{case_number}}  \n**Courtroom / remote link:** {{courtroom}}\n\n## Appearances\n- [Name and role]\n\n## Proceedings\n[Record of the hearing]\n\n## Rulings\n[Rulings or next steps]",
};
