import React, { useState } from 'react';
import { locationsAPI, type PostalOffice } from '../services/api';

export type PostalAddress = {
  address: string;
  city: string;
  state: string;
  postalCode: string;
  district: string;
  postOffice: string;
};
export const emptyPostalAddress = (): PostalAddress => ({ address: '', city: '', state: '', postalCode: '', district: '', postOffice: '' });

const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950';

export const PostalAddressFields: React.FC<{
  value: PostalAddress;
  onChange: (value: PostalAddress) => void;
  required?: boolean;
  addressLabel?: string;
  className?: string;
}> = ({ value, onChange, required = true, addressLabel = 'Street address', className = '' }) => {
  const [offices, setOffices] = useState<PostalOffice[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const update = (patch: Partial<PostalAddress>) => onChange({ ...value, ...patch });
  const lookup = async () => {
    setMessage('');
    if (!/^[1-9][0-9]{5}$/.test(value.postalCode)) {
      setMessage('Enter a valid 6-digit Indian PIN code.');
      return;
    }
    setLoading(true);
    setOffices([]);
    try {
      const result = await locationsAPI.lookupPincode(value.postalCode);
      setOffices(result.offices);
      const states = [...new Set(result.offices.map((office) => office.state))];
      const cities = [...new Set(result.offices.map((office) => office.city))];
      const districts = [...new Set(result.offices.map((office) => office.district))];
      update({
        state: states.length === 1 ? states[0] : value.state,
        city: cities.length === 1 ? cities[0] : value.city,
        district: districts.length === 1 ? districts[0] : value.district,
        postOffice: result.offices.length === 1 ? result.offices[0].name : '',
      });
      setMessage(result.offices.length === 1
        ? 'Postal area found. Check the filled details and edit locality if needed.'
        : 'Choose your post office to fill its matching district and locality.');
    } catch (error: any) {
      setMessage(error.response?.data?.message || 'Postal lookup is unavailable. You can enter the address manually.');
    } finally {
      setLoading(false);
    }
  };

  const chooseOffice = (officeName: string) => {
    const office = offices.find((item) => item.name === officeName);
    update({
      postOffice: officeName,
      city: office?.city || value.city,
      district: office?.district || value.district,
      state: office?.state || value.state,
    });
  };

  return <div className={`grid gap-3 sm:grid-cols-2 ${className}`}>
    <label className="text-xs font-medium sm:col-span-2">{addressLabel}{required ? ' *' : ''}
      <input required={required} maxLength={300} value={value.address} onChange={(event) => update({ address: event.target.value })} className={fieldClass} autoComplete="street-address" />
    </label>
    <div>
      <label className="text-xs font-medium" htmlFor="postal-address-pincode">PIN code{required ? ' *' : ''}</label>
      <div className="mt-1 flex gap-2">
        <input id="postal-address-pincode" required={required} type="text" inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} autoComplete="postal-code" value={value.postalCode} onChange={(event) => { setOffices([]); setMessage(''); update({ postalCode: event.target.value.replace(/\D/g, '').slice(0, 6), postOffice: '', city: '', district: '', state: '' }); }} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
        <button type="button" disabled={loading} onClick={() => void lookup()} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50">{loading ? 'Looking…' : 'Find'}</button>
      </div>
    </div>
    {offices.length > 1 && <label className="text-xs font-medium">Post office / locality
      <select required={required} value={value.postOffice} onChange={(event) => chooseOffice(event.target.value)} className={fieldClass}>
        <option value="">Select post office</option>
        {offices.map((office) => <option key={`${office.name}-${office.district}`} value={office.name}>{office.name} · {office.district}</option>)}
      </select>
    </label>}
    {offices.length === 1 && <p className="self-end pb-2 text-xs text-slate-500">Post office: {offices[0].name}</p>}
    <label className="text-xs font-medium">City / locality{required ? ' *' : ''}
      <input required={required} maxLength={100} value={value.city} onChange={(event) => update({ city: event.target.value })} className={fieldClass} autoComplete="address-level2" />
    </label>
    <label className="text-xs font-medium">District
      <input maxLength={100} value={value.district} onChange={(event) => update({ district: event.target.value })} className={fieldClass} />
    </label>
    <label className="text-xs font-medium">State{required ? ' *' : ''}
      <input required={required} maxLength={100} value={value.state} onChange={(event) => update({ state: event.target.value })} className={fieldClass} autoComplete="address-level1" />
    </label>
    {message && <p role="status" className="text-xs text-slate-500 sm:col-span-2">{message}</p>}
  </div>;
};
