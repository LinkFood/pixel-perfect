interface WatermarkedImageProps {
  src: string;
  alt?: string;
  className?: string;
}

const WatermarkedImage = ({ src, alt = "", className = "" }: WatermarkedImageProps) => {
  return (
    <div className="relative overflow-hidden select-none">
      <img src={src} alt={alt} className={className} draggable={false} />
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{
          background: "repeating-linear-gradient(-45deg, transparent, transparent 80px, hsla(25, 30%, 15%, 0.06) 80px, hsla(25, 30%, 15%, 0.06) 82px)",
        }}
      >
        <span
          className="font-display text-foreground/15 text-4xl md:text-6xl font-bold whitespace-nowrap select-none"
          style={{ transform: "rotate(-35deg)" }}
        >
          PhotoRabbit
        </span>
      </div>
    </div>
  );
};

export default WatermarkedImage;
