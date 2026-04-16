export function Footer() {
  return (
    <footer className="hidden md:block border-t border-white/8 py-8 px-6 mt-auto">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Eden Studio. Tous droits réservés.
        </p>
        <p className="text-xs text-muted-foreground/50">
          Crafted with passion — web-first game studio
        </p>
      </div>
    </footer>
  );
}
