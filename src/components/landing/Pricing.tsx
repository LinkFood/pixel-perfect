import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";

const tiers = [
  {
    name: "Starter",
    credits: 15,
    price: "$4.99",
    perCredit: "$0.33",
    description: "Try it out, make a few illustrations",
    features: [
      "15 illustration credits",
      "Generate or regenerate any page",
      "Full PDF download",
      "No expiration",
    ],
    featured: false,
  },
  {
    name: "Standard",
    credits: 40,
    price: "$9.99",
    perCredit: "$0.25",
    badge: "Most Popular",
    description: "Enough for one book with tweaking",
    features: [
      "40 illustration credits",
      "~3 variants per page for a 13-page book",
      "Full PDF download",
      "No expiration",
      "Best per-credit value",
    ],
    featured: true,
  },
  {
    name: "Pro",
    credits: 100,
    price: "$19.99",
    perCredit: "$0.20",
    description: "Heavy iteration or multiple books",
    features: [
      "100 illustration credits",
      "Perfect for multiple projects",
      "Full PDF download",
      "No expiration",
      "Lowest per-credit cost",
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
            Pay for what you create
          </h2>
          <p className="text-muted-foreground font-body mt-4 max-w-lg mx-auto">
            Every new account starts with <span className="font-semibold text-primary">3 free credits</span>. 
            Upload photos, chat, and write your story for free — credits are only used for illustrations.
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
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-display font-bold">{tier.price}</span>
              </div>
              <p className={`text-xs font-body mb-6 ${tier.featured ? "opacity-50" : "text-muted-foreground"}`}>
                {tier.perCredit} per credit · {tier.credits} credits
              </p>
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
                asChild
              >
                <a href="/auth">Get Started</a>
              </Button>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center mt-12"
        >
          <div className="inline-flex items-center gap-2 bg-secondary/60 rounded-full px-5 py-2.5">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-body text-sm text-foreground">
              Uploading photos, chatting, and story writing are always <strong>free</strong>
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Pricing;
