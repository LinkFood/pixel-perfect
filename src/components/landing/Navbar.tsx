import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-6 lg:px-12 flex items-center justify-between h-16">
        <a href="/" className="font-display text-lg font-semibold text-foreground tracking-tight">
          PetPage Studios
        </a>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#how" className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors">How It Works</a>
          <a href="#pricing" className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
          <a href="#stories" className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors">Stories</a>
          <Button variant="hero" size="sm" className="rounded-lg px-5">
            Start Your Book
          </Button>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setOpen(!open)} className="md:hidden text-foreground">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-background border-b border-border px-6 pb-6 space-y-4">
          <a href="#how" className="block font-body text-sm text-muted-foreground" onClick={() => setOpen(false)}>How It Works</a>
          <a href="#pricing" className="block font-body text-sm text-muted-foreground" onClick={() => setOpen(false)}>Pricing</a>
          <a href="#stories" className="block font-body text-sm text-muted-foreground" onClick={() => setOpen(false)}>Stories</a>
          <Button variant="hero" size="sm" className="w-full rounded-lg">Start Your Book</Button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
