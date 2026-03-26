export const parseOverlay = (data: string): number[] => {
  return data.trim().split("\n").map(Number);
};

export const processColorMap = (colorMapStr: string): number[][] => {
  const lines = colorMapStr.trim().replace(/\t/g, " ").split("\n");
  return lines.map((line) => line.split(/\s+/).map(Number));
};
