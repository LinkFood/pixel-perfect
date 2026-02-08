import { motion } from "framer-motion";
import { Camera, MessageCircleHeart, BookOpen } from "lucide-react";

const steps = [
  {
    icon: Camera,
    number: "01",
    title: "Upload Photos",
    description: "Share your favorite photos. Our AI analyzes every detail — setting, mood, who's there — so your book captures real moments, not generic ones.",
  },
  {
    icon: MessageCircleHeart,
    number: "02",
    title: "Tell Their Story",
    description: "Our interviewer already knows your photos. It asks about the people, places, and moments it saw — drawing out the stories behind each one.",
  },
  {
    icon: BookOpen,
    number: "03",
    title: "Get Your Book",
    description: "We generate a fully illustrated storybook with multiple art options per page, plus a photo memory book. Review, pick your favorites, and download.",
  },
];

const HowItWorks = () => {
  return (
    <section className="py-24 lg:py-32 bg-background">
      <div className="container mx-auto px-6 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 lg:mb-20"
        >
          <p className="text-sm font-body uppercase tracking-[0.2em] text-muted-foreground mb-3">How It Works</p>
          <h2 className="text-3xl lg:text-4xl font-display font-semibold text-foreground">
            Three steps to a lasting memory
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12 max-w-5xl mx-auto">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className="text-center group"
            >
              <div className="relative mb-6 inline-flex">
                <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
                  <step.icon className="w-7 h-7 text-primary" />
                </div>
                <span className="absolute -top-2 -right-2 text-xs font-display font-bold text-accent bg-card rounded-full w-7 h-7 flex items-center justify-center border border-border">
                  {step.number}
                </span>
              </div>
              <h3 className="text-xl font-display font-semibold text-foreground mb-3">{step.title}</h3>
              <p className="text-muted-foreground font-body leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
