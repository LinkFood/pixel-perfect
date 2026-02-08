import { motion } from "framer-motion";
import { Sparkles, Palette, BookMarked, Heart } from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "Not a template",
    description: "Not Mad Libs with a name swapped in. YOUR real story, drawn from a warm AI interview about your actual memories.",
  },
  {
    icon: Palette,
    title: "AI that actually looked",
    description: "Our AI studies your photos before the conversation starts. It knows the people, places, and moments — so nothing feels generic.",
  },
  {
    icon: BookMarked,
    title: "Multiple options",
    description: "Get 3 illustrated versions of every page. Pick your favorite or generate more.",
  },
  {
    icon: Heart,
    title: "Built from love",
    description: "Founded by someone who lost his dog Link and built what he wished existed. Now we make keepsakes for pets, people, and every memory worth preserving.",
  },
];

const WhatMakesUsDifferent = () => {
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
          <p className="text-sm font-body uppercase tracking-[0.2em] text-muted-foreground mb-3">Why PhotoRabbit</p>
          <h2 className="text-3xl lg:text-4xl font-display font-semibold text-foreground text-balance">
            Because their story deserves more than a template
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-background rounded-2xl p-8 border border-border hover:border-primary/20 transition-all duration-300"
              style={{ boxShadow: "var(--card-shadow)" }}
            >
              <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-5">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-display font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-muted-foreground font-body leading-relaxed text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhatMakesUsDifferent;
