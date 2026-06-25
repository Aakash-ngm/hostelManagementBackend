// All times are IST (UTC+5:30)

const getISTNow = () => {
  const now = new Date();
  // Convert to IST
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + istOffset - now.getTimezoneOffset() * 60 * 1000);
};

const getCurrentISTDate = () => {
  const ist = getISTNow();
  return ist.toISOString().split('T')[0]; // YYYY-MM-DD
};

const getMovementTypeByTime = () => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  // Evening Outing: 4:30 PM - 6:30 PM (16:30 - 18:30)
  if (totalMinutes >= 16 * 60 + 30 && totalMinutes <= 18 * 60 + 30) {
    return 'EveningOuting';
  }
  // Dinner Break: 8:00 PM - 9:00 PM (20:00 - 21:00)
  if (totalMinutes >= 20 * 60 && totalMinutes <= 21 * 60) {
    return 'DinnerBreak';
  }
  return null; // Requires explicit movement type
};

const isLateReturn = (inTime, movementType, permissionUntil = null) => {
  const inDate = new Date(inTime);
  const hours = inDate.getHours();
  const minutes = inDate.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  if (movementType === 'Permission' && permissionUntil) {
    const permissionTime = new Date(permissionUntil);
    return inDate > permissionTime;
  }

  if (movementType === 'EveningOuting') {
    // Must return by 6:30 PM (18:30)
    const cutoff = 18 * 60 + 30;
    return totalMinutes > cutoff;
  }

  if (movementType === 'DinnerBreak') {
    // Must return by 9:00 PM (21:00)
    const cutoff = 21 * 60;
    return totalMinutes > cutoff;
  }

  return false;
};

const getLateByMinutes = (inTime, movementType, permissionUntil = null) => {
  if (!isLateReturn(inTime, movementType, permissionUntil)) return 0;

  const inDate = new Date(inTime);
  const hours = inDate.getHours();
  const minutes = inDate.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  if (movementType === 'Permission' && permissionUntil) {
    const permissionDate = new Date(permissionUntil);
    return Math.floor((inDate - permissionDate) / 60000);
  }

  if (movementType === 'EveningOuting') {
    return totalMinutes - (18 * 60 + 30);
  }

  if (movementType === 'DinnerBreak') {
    return totalMinutes - 21 * 60;
  }

  return 0;
};

const formatDuration = (minutes) => {
  if (!minutes) return '0 mins';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} mins`;
  return `${h}h ${m}m`;
};

module.exports = {
  getISTNow,
  getCurrentISTDate,
  getMovementTypeByTime,
  isLateReturn,
  getLateByMinutes,
  formatDuration,
};
