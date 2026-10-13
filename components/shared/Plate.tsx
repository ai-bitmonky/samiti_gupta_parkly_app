/* Indian number plate chip. <Plate plate="DL 8C AF 4521" size="sm" | "lg" /> */
export default function Plate({ plate, size }: { plate: string; size?: "sm" | "lg" }) {
  return (
    <span className={`plate${size ? " plate-" + size : ""}`}>
      <span className="plate-ind">IND</span>
      <span className="plate-no">{plate}</span>
    </span>
  );
}
