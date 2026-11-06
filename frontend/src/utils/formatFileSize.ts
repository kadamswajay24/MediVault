const FILE_SIZE_UNITS = ['KB', 'MB', 'GB', 'TB'];

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;

  let size = bytes;
  let unitIndex = -1;
  do {
    size /= 1024;
    unitIndex += 1;
  } while (size >= 1024 && unitIndex < FILE_SIZE_UNITS.length - 1);

  return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(size)} ${FILE_SIZE_UNITS[unitIndex]}`;
};
