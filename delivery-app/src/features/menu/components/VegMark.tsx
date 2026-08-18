export function VegMark({ isVeg }: { isVeg: boolean }) {
  return (
    <span
      className={`veg-mark ${isVeg ? 'veg-mark-veg' : 'veg-mark-nonveg'}`}
      title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
    />
  );
}