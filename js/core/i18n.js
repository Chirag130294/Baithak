// English text is the key. If a Gujarati string exists it is used, otherwise English shows.
// Games can add their own strings with registerStrings('gu', {...}) so they stay self-contained.
import { ls } from './util.js';

const dict = { gu: {} };
let lang = ls.get('baithak:lang', 'en');

export const getLang = () => lang;
export function setLang(l) { lang = l === 'gu' ? 'gu' : 'en'; ls.set('baithak:lang', lang); document.documentElement.lang = lang; }
export function registerStrings(l, strings) { dict[l] = Object.assign(dict[l] || {}, strings); }

export function t(key, vars) {
  let s = (lang !== 'en' && dict[lang] && dict[lang][key]) || key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return s;
}

// Gujarati wording below should get a quick read from a native speaker before release.
registerStrings('gu', {
  'Too many wrong codes. Try again in {t}.': 'ઘણા ખોટા કોડ. {t} પછી ફરી પ્રયત્ન કરો.',
  'Too many wrong codes.': 'ઘણા ખોટા કોડ.', 'Please wait': 'થોડી રાહ જુઓ',
  'Private room': 'ખાનગી રૂમ', 'Unlock': 'ખોલો', 'That PIN is not right.': 'આ PIN સાચો નથી.',
  'This room needs a PIN. Ask the host.': 'આ રૂમ માટે PIN જોઈએ. હોસ્ટને પૂછો.',
  'Private room PIN (optional)': 'ખાનગી રૂમ PIN (વૈકલ્પિક)', '4 to 6 digits': '4 થી 6 આંકડા',
  'Games': 'રમતો', 'Rooms': 'રૂમ', 'Profile': 'પ્રોફાઇલ', 'Home': 'હોમ',
  'Sign in': 'સાઇન ઇન', 'Sign out': 'સાઇન આઉટ',
  'Continue with Google': 'Google સાથે આગળ વધો',
  'Continue with email link': 'ઇમેઇલ લિંકથી આગળ વધો',
  'Continue with phone number': 'ફોન નંબરથી આગળ વધો',
  'Play as guest': 'મહેમાન તરીકે રમો',
  'Create a room': 'રૂમ બનાવો', 'Create room and get code': 'રૂમ બનાવો અને કોડ મેળવો',
  'Watch': 'જુઓ', 'Room code': 'રૂમ કોડ', 'Scan the host\'s QR code': 'હોસ્ટનો QR કોડ સ્કેન કરો',
  'Scan QR or code': 'QR કે કોડ', 'Type the room code': 'રૂમ કોડ લખો',
  'Players': 'ખેલાડીઓ', 'Add player': 'ખેલાડી ઉમેરો', 'Shuffle seats': 'બેઠક ફેરવો',
  'Start': 'શરૂ કરો', 'Pause': 'થોભાવો', 'Resume': 'ફરી શરૂ કરો', 'Undo': 'પાછું લો',
  'Round': 'રાઉન્ડ', 'Lap': 'લેપ', 'Bid': 'બિડ', 'Bids': 'બિડ', 'Trump': 'ટ્રમ્પ', 'Dealer': 'ડીલર',
  'cards': 'પત્તા', 'Standings': 'ક્રમ', 'Total': 'કુલ', 'Round book': 'રાઉન્ડ બુક',
  'Invite': 'આમંત્રણ', 'Copy link': 'લિંક કૉપિ કરો', 'Share': 'શેર કરો',
  'End game': 'રમત પૂરી કરો', 'Rematch': 'ફરી રમો', 'Install app': 'એપ ઇન્સ્ટોલ કરો',
  'Language': 'ભાષા', 'Back': 'પાછળ', 'Live': 'લાઇવ', 'Paused': 'થોભાવેલ', 'View only': 'ફક્ત જોવા માટે',
  'Save round': 'રાઉન્ડ સાચવો', 'Lock bids and start round': 'બિડ લૉક કરો અને શરૂ કરો',
  'Tricks won': 'જીતેલા હાથ', 'Seats and players': 'બેઠક અને ખેલાડીઓ', 'Change log': 'ફેરફારનો લોગ',
  'Sit out': 'બહાર બેસો', 'Sit in': 'પાછા બેસો', 'Cancel': 'રદ કરો', 'Save': 'સાચવો', 'Done': 'થઈ ગયું',
  'Your rooms': 'તમારા રૂમ', 'Your regulars': 'નિયમિત ખેલાડીઓ', 'Continue playing': 'રમત ચાલુ રાખો',
  'Kali': 'કાળી', 'Chatai': 'ચટાઈ', 'Fuli': 'ફૂલી', 'Lal': 'લાલ', 'No trump': 'ટ્રમ્પ નહીં',
  'Colour theme': 'રંગ થીમ', 'Look': 'દેખાવ', 'Sleek (compact)': 'સ્લીક (નાનું)', 'Classic (big buttons)': 'ક્લાસિક (મોટા બટન)',
  'Felt Green': 'ફેલ્ટ ગ્રીન', 'Midnight Gold': 'મિડનાઇટ ગોલ્ડ', 'Clean Light': 'ક્લીન લાઇટ', 'Arcade Purple': 'આર્કેડ પર્પલ',
  'Mode': 'મોડ', 'Seats': 'બેઠક', 'Pause game': 'રમત થોભાવો', 'Resume game': 'રમત ફરી શરૂ કરો',
  'Show all {n} rounds': 'બધા {n} રાઉન્ડ બતાવો', 'Show last 2 only': 'છેલ્લા 2 જ બતાવો', 'Game over': 'રમત પૂરી', 'Share picture': 'ફોટો શેર કરો'
});
