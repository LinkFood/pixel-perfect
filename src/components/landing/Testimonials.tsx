import { motion } from "framer-motion";
import { Star } from "lucide-react";

const testimonials = [
  {
    quote: "I thought no one could capture what Max meant to us. Then I saw the book and cried — in the best way. My daughter reads it every night.",
    author: "Sarah M.",
    subject: "Max, Golden Retriever",
    stars: 5,
  },
  {
    quote: "We made a birthday book for my daughter's 5th. The AI interview pulled out stories I'd forgotten — her first word, the park incident. She carries it everywhere.",
    author: "David K.",
    subject: "Lily's 5th Birthday Book",
    stars: 5,
  },
  {
    quote: "Our friend group made a roast book for Jake's 30th. Everyone uploaded photos and did the interview. He ugly-cried at the party. Best $10 we ever split.",
    author: "Priya N.",
    subject: "Jake's 30th Birthday Roast",
    stars: 5,
  },
];

const Testimonials = () => {
  return (
    <section className="py-24 lg:py-32 bg-card/50">
      <div className="container mx-auto px-6 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 lg:mb-20"
        >
          <p className="text-sm font-body uppercase tracking-[0.2em] text-muted-foreground mb-3">From our community</p>
          <h2 className="text-3xl lg:text-4xl font-display font-semibold text-foreground">
            Every creation tells a love story
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.author}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="bg-background rounded-2xl p-8 border border-border"
              style={{ boxShadow: "var(--card-shadow)" }}
            >
              <div className="flex gap-0.5 mb-5">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-accent text-accent" />
                ))}
              </div>
              <blockquote className="text-foreground font-body leading-relaxed mb-6 text-[15px]">
                "{t.quote}"
              </blockquote>
              <div>
                <p className="font-display font-semibold text-foreground text-sm">{t.author}</p>
                <p className="text-muted-foreground text-xs font-body">{t.subject}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
