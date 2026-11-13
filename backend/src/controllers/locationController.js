const PIN_LOOKUP_URL = 'https://api.postalpincode.in/pincode/';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 1000;
const pinCache = new Map();

export const lookupIndianPincode = async (req, res, next) => {
  try {
    const { pincode } = req.params;
    if (!/^\d{6}$/.test(pincode)) return res.status(400).json({ success: false, message: 'Enter a valid 6-digit Indian PIN code.' });

    const cached = pinCache.get(pincode);
    if (cached && cached.expiresAt > Date.now()) return res.json({ success: true, ...cached.value, cached: true });
    if (cached) pinCache.delete(pincode);

    const response = await fetch(`${PIN_LOOKUP_URL}${pincode}`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return res.status(502).json({ success: false, message: 'The postal directory is temporarily unavailable. You can still enter your address manually.' });
    const payload = await response.json();
    const result = Array.isArray(payload) ? payload.find((item) => item.Status === 'Success' && Array.isArray(item.PostOffice)) : null;
    if (!result) return res.status(404).json({ success: false, message: 'No postal areas were found for this PIN code.' });

    const offices = result.PostOffice.map((office) => ({
      name: String(office.Name || '').trim(),
      city: String(office.Block || office.District || '').trim(),
      district: String(office.District || '').trim(),
      state: String(office.State || '').trim(),
      pincode: String(office.Pincode || pincode).trim(),
    })).filter((office) => office.name && office.city && office.state && office.pincode === pincode);
    const uniqueOffices = [...new Map(offices.map((office) => [office.name.toLocaleLowerCase(), office])).values()];
    if (!uniqueOffices.length) return res.status(404).json({ success: false, message: 'No usable postal areas were found for this PIN code.' });

    const value = { pincode, offices: uniqueOffices };
    if (pinCache.size >= MAX_CACHE_ENTRIES) pinCache.delete(pinCache.keys().next().value);
    pinCache.set(pincode, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return res.json({ success: true, ...value, cached: false });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') return res.status(504).json({ success: false, message: 'The postal directory took too long to respond. You can still enter your address manually.' });
    if (error instanceof SyntaxError) return res.status(502).json({ success: false, message: 'The postal directory returned an invalid response. You can still enter your address manually.' });
    return next(error);
  }
};
