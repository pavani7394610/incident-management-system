// --- MTTR Calculation Service ---
// Automatically calculates how long an incident took to fix

const calculateMTTR = (startTime, endTime) => {
  const start = new Date(startTime);
  const end   = new Date(endTime);

  // Difference in milliseconds → convert to seconds
  const mttrSeconds = Math.floor((end - start) / 1000);

  if (mttrSeconds < 0) {
    throw new Error('End time cannot be before start time');
  }

  return {
    mttrSeconds,
    // Human-readable format for display
    mttrFormatted: formatDuration(mttrSeconds),
  };
};

// Convert seconds into "2h 15m 30s" format
const formatDuration = (totalSeconds) => {
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours   > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(' ');
};

module.exports = { calculateMTTR };