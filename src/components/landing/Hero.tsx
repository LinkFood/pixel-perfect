import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-storybook.jpg";

const Hero = () => {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden" style={{ background: "var(--hero-gradient)" }}>
      {/* Decorative paw prints */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <div className="absolute top-20 left-[10%] text-6xl rotate-[-15deg]">🐾</div>
        <div className="absolute top-40 right-[15%] text-4xl rotate-[20deg]">🐾</div>
        <div className="absolute bottom-32 left-[20%] text-5xl rotate-[10deg]">🐾</div>
        <div className="absolute bottom-20 right-[25%] text-3xl rotate-[-25deg]">🐾</div>
      </div>

      <div className="container mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Text content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-xl"
          >
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-sm font-body uppercase tracking-[0.2em] text-muted-foreground mb-4"
            >
              PetPage Studios
            </motion.p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-semibold leading-[1.15] text-foreground mb-6 text-balance">
              Every pet has a story worth keeping.
            </h1>
            <p className="text-lg lg:text-xl font-body text-muted-foreground leading-relaxed mb-10 text-balance">
              Upload your photos, share your memories, and we'll create a beautifully illustrated children's book that looks like YOUR pet — so the ones you love will always know them.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="hero" size="lg" className="px-8 py-6 text-base rounded-xl">
                Start Your Pet's Story
              </Button>
              <Button variant="hero-outline" size="lg" className="px-8 py-6 text-base rounded-xl">
                See How It Works
              </Button>
            </div>
          </motion.div>

          {/* Hero image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden" style={{ boxShadow: "var(--card-shadow)" }}>
              <img
                src={heroImage}
                alt="An open illustrated children's storybook featuring a golden retriever in a watercolor garden"
                className="w-full h-auto"
              />
            </div>
            {/* Floating badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.6 }}
              className="absolute -bottom-4 -left-4 lg:-left-8 bg-card rounded-xl px-5 py-3 font-body text-sm text-card-foreground"
              style={{ boxShadow: "var(--card-shadow)" }}
            >
              <span className="text-2xl mr-2">📖</span>
              <span className="font-medium">Every book is unique</span>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
