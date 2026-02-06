import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import WhatMakesUsDifferent from "@/components/landing/WhatMakesUsDifferent";
import Pricing from "@/components/landing/Pricing";
import Testimonials from "@/components/landing/Testimonials";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-16">
        <Hero />
        <div id="how">
          <HowItWorks />
        </div>
        <WhatMakesUsDifferent />
        <div id="pricing">
          <Pricing />
        </div>
        <div id="stories">
          <Testimonials />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
