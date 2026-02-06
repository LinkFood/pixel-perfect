import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const tiers = [
  {
    name: "Photo Memory Book",
    price: "$19.99",
    description: "Your real photos, beautifully curated",
    features: [
      "Curated photo book from your uploads",
      "Captions from your memories",
      "Organized narrative timeline",
      "Print-ready digital PDF",
    ],
    featured: false,
  },
  {
    name: "The Complete Bundle",
    price: "$39.99",
    originalPrice: "$49.98",
    badge: "Save $10",
    description: "Both books + priority generation",
    features: [
      "Everything in both books",
      "Priority AI generation",
      "Custom LoRA-trained illustrations",
      "Two print-ready PDFs",
      "Best value",
    ],
    featured: true,
  },
  {
    name: "Illustrated Storybook",
    price: "$29.99",
    description: "A children's book starring YOUR pet",
    features: [
      "24-page illustrated children's book",
      "AI illustrations of YOUR pet",
      "Written from your real memories",
      "Print-ready digital PDF",
    ],
    featured: false,
  },
];

const Pricing = () => {
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
          <p className="text-sm font-body uppercase tracking-[0.2em] text-muted-foreground mb-3">Pricing</p>
          <h2 className="text-3xl lg:text-4xl font-display font-semibold text-foreground">
            Choose your keepsake
          </h2>
          <p className="text-muted-foreground font-body mt-4 max-w-lg mx-auto">
            Hardcover print add-ons available at checkout starting at $24.99
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto items-start">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: i * 0.12 }}
              className={`relative rounded-2xl p-8 border transition-all duration-300 ${
                tier.featured
                  ? "bg-foreground text-background border-foreground scale-[1.03]"
                  : "bg-card border-border hover:border-primary/20"
              }`}
              style={!tier.featured ? { boxShadow: "var(--card-shadow)" } : undefined}
            >
              {tier.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground text-xs font-body font-semibold px-4 py-1 rounded-full">
                  {tier.badge}
                </span>
              )}
              <h3 className={`text-lg font-display font-semibold mb-1 ${tier.featured ? "" : "text-foreground"}`}>
                {tier.name}
              </h3>
              <p className={`text-sm font-body mb-5 ${tier.featured ? "opacity-70" : "text-muted-foreground"}`}>
                {tier.description}
              </p>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-3xl font-display font-bold">{tier.price}</span>
                {tier.originalPrice && (
                  <span className="text-sm line-through opacity-50">{tier.originalPrice}</span>
                )}
              </div>
              <ul className="space-y-3 mb-8">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm font-body">
                    <Check className={`w-4 h-4 mt-0.5 shrink-0 ${tier.featured ? "opacity-80" : "text-primary"}`} />
                    <span className={tier.featured ? "opacity-90" : "text-muted-foreground"}>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                variant={tier.featured ? "hero" : "hero-outline"}
                className={`w-full rounded-xl py-5 ${
                  tier.featured ? "bg-background text-foreground hover:bg-background/90" : ""
                }`}
              >
                Get Started
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
