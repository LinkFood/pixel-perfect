const Footer = () => {
  return (
    <footer className="py-16 bg-foreground text-background/80">
      <div className="container mx-auto px-6 lg:px-12">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <h3 className="font-display text-xl font-semibold text-background mb-3">PetPage Studios</h3>
            <p className="font-body text-sm leading-relaxed max-w-sm text-background/60">
              Founded by a pet owner who lost his dog Link after 10 years — and built the product he wished existed. Every pet's story deserves to be told beautifully.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-display font-semibold text-background text-sm mb-4">Company</h4>
            <ul className="space-y-2 font-body text-sm">
              <li><a href="#" className="hover:text-background transition-colors">About</a></li>
              <li><a href="#" className="hover:text-background transition-colors">How It Works</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-background transition-colors">FAQ</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-semibold text-background text-sm mb-4">Legal</h4>
            <ul className="space-y-2 font-body text-sm">
              <li><a href="#" className="hover:text-background transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Contact</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-background/10 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="font-body text-xs text-background/40">
            © {new Date().getFullYear()} PetPage Studios. All rights reserved.
          </p>
          <p className="font-body text-sm text-background/50">
            Made with 🐾 by PetPage Studios
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
