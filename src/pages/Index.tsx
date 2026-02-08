import { useState } from "react";
import { motion } from "framer-motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import RabbitChat from "@/components/landing/RabbitChat";

const bookTypes = [
  { label: "Pet Memorial", angle: -6, top: "15%", left: "-60px", color: "#D4A574" },
  { label: "Kid's Adventure", angle: 4, top: "35%", right: "-60px", color: "#8FB5A3" },
  { label: "Grandparent Book", angle: -3, bottom: "30%", left: "-50px", color: "#B8A4C8" },
  { label: "Roast Book", angle: 5, bottom: "12%", right: "-50px", color: "#E8B4A0" },
];

const faqs = [
  {
    q: "What can I make?",
    a: "Books, cards, portraits, anything illustrated from your real photos. You share the photos, chat with Rabbit about the memories, and we create something completely unique.",
  },
  {
    q: "How long does it take?",
    a: "The chat takes about 10 minutes, generation takes about 15 minutes, and you review everything before paying. Most people finish in under an hour.",
  },
  {
    q: "How much does it cost?",
    a: "Uploading photos, chatting, and story writing are free. You only pay for illustration credits — starting at $4.99 for 15 credits. Every new account gets 3 free credits to try it out.",
  },
  {
    q: "Is this AI-generated?",
    a: "Yes — our AI studies YOUR photos so illustrations actually look like your person or pet. You approve every single page before anything is finalized.",
  },
];

const Index = () => {
  const [hoveredBook, setHoveredBook] = useState<string | null>(null);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#FDF8F0" }}>
      {/* Minimal nav */}
      <nav className="flex items-center justify-between px-6 lg:px-12 h-14 shrink-0">
        <a href="/" className="font-display text-lg font-semibold tracking-tight" style={{ color: "#2C2417" }}>
          PhotoRabbit
        </a>
        <div className="flex items-center gap-6">
          <a href="#pricing" className="hidden sm:block font-body text-sm transition-colors hover:text-foreground" style={{ color: "#6B5D4F" }}>
            Pricing
          </a>
          <a href="/dashboard" className="font-body text-sm font-medium transition-colors hover:text-foreground" style={{ color: "#C4956A" }}>
            Sign In
          </a>
        </div>
      </nav>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Floating book thumbnails — desktop only */}
        <div className="hidden lg:block absolute inset-0 pointer-events-none">
          {bookTypes.map(book => (
            <motion.div
              key={book.label}
              className="absolute pointer-events-auto cursor-pointer"
              style={{
                top: book.top,
                bottom: book.bottom,
                left: book.left,
                right: book.right,
                transform: `rotate(${book.angle}deg)`,
                opacity: hoveredBook === book.label ? 0.95 : 0.55,
                transition: "opacity 0.3s",
              }}
              onMouseEnter={() => setHoveredBook(book.label)}
              onMouseLeave={() => setHoveredBook(null)}
              whileHover={{ scale: 1.05 }}
            >
              <div
                className="w-[90px] h-[110px] rounded-lg shadow-md flex items-end p-2"
                style={{ background: `linear-gradient(135deg, ${book.color}, ${book.color}dd)` }}
              >
                <span className="font-body text-[9px] font-medium text-white leading-tight">
                  {book.label}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        <RabbitChat />
      </div>

      {/* Below the fold — minimal */}
      <div style={{ background: "#FDF8F0" }}>
        {/* Social proof */}
        <div className="py-10 border-t" style={{ borderColor: "#E8D5C0" }}>
          <div className="max-w-2xl mx-auto px-6 text-center space-y-6">
            <p className="font-display text-sm uppercase tracking-[0.2em]" style={{ color: "#9B8E7F" }}>
              From our community
            </p>
            <div className="space-y-4">
              <p className="font-body text-sm italic" style={{ color: "#6B5D4F" }}>
                "I thought no one could capture what Max meant to us. Then I saw the book and cried — in the best way."
                <span className="not-italic font-medium"> — Sarah M.</span>
              </p>
              <p className="font-body text-sm italic" style={{ color: "#6B5D4F" }}>
                "The AI interview felt like talking to a friend who truly cared. Every detail I shared ended up in the story."
                <span className="not-italic font-medium"> — James R.</span>
              </p>
              <p className="font-body text-sm italic" style={{ color: "#6B5D4F" }}>
                "My son never got to meet Buddy. Now he has a book that tells Buddy's real story with illustrations that look exactly like him."
                <span className="not-italic font-medium"> — Maria T.</span>
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div id="pricing" className="py-10 border-t" style={{ borderColor: "#E8D5C0" }}>
          <div className="max-w-xl mx-auto px-6">
            <h3 className="font-display text-lg font-semibold text-center mb-6" style={{ color: "#2C2417" }}>
              Common Questions
            </h3>
            <Accordion type="single" collapsible className="space-y-2">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="rounded-xl border px-4" style={{ borderColor: "#E8D5C0" }}>
                  <AccordionTrigger className="font-body text-sm font-medium py-3 hover:no-underline" style={{ color: "#2C2417" }}>
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="font-body text-sm pb-3" style={{ color: "#6B5D4F" }}>
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>

        {/* Minimal footer */}
        <footer className="py-6 border-t text-center" style={{ borderColor: "#E8D5C0" }}>
          <div className="flex items-center justify-center gap-4 font-body text-xs" style={{ color: "#9B8E7F" }}>
            <span>PhotoRabbit</span>
            <span>&copy; {new Date().getFullYear()}</span>
            <a href="#" className="hover:underline">Privacy</a>
            <a href="#" className="hover:underline">Terms</a>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Index;
