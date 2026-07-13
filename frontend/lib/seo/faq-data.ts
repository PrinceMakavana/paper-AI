export type FaqItem = {
  q: string;
  a: string;
};

export const LANDING_FAQS: FaqItem[] = [
  {
    q: "What is paperAI?",
    a: "paperAI is an AI-powered platform that generates GTU paper solutions and lets you chat with your study documents — built specifically for GTU students.",
  },
  {
    q: "Can it solve GTU papers?",
    a: "Yes. Select the subject and Ask questions to AI and it will generate detailed, exam-focused answers question by question.",
  },
  {
    q: "Which AI models are used?",
    a: "paperAI supports Google Gemini model.",
  },
  {
    q: "Can I upload PDFs?",
    a: "Absolutely. Upload notes, textbooks, research papers, and reference material to summarize and ask questions against.",
  },
  {
    q: "Is my data secure?",
    a: "Documents are stored in a protected workspace tied to your account. With Ollama you can run models entirely on your machine.",
  },
  {
    q: "Can I revisit previous documents?",
    a: "Yes. Document history keeps every workspace ready so you can return to past papers and notes anytime.",
  },
  {
    q: "Does it support previous year papers?",
    a: "paperAI is optimized for previous year GTU papers — analyzing patterns and highlighting frequently asked topics.",
  },
];
