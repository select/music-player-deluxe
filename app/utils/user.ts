// Generate a unique color from user string
export const getUserColor = (userId: string): string => {
	let hash = 0;
	for (let i = 0; i < userId.length; i++) {
		hash = userId.charCodeAt(i) + ((hash << 5) - hash);
	}

	// Generate HSL color with good saturation and lightness for visibility
	const hue = Math.abs(hash) % 360;
	const saturation = 65 + (Math.abs(hash) % 20); // 65-85%
	const lightness = 45 + (Math.abs(hash) % 15); // 45-60%

	return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};
