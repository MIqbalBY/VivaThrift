export const CHECKOUT_MEETUP_LOCATIONS = [
  { id: 'aula_asrama', label: 'Aula Asrama ITS' },
  { id: 'ccws_ikoma', label: 'CCWS IKOMA ITS' },
  { id: 'rektorat', label: 'Depan Rektorat ITS' },
  { id: 'gedung_robotika', label: 'Gedung Robotika ITS' },
  { id: 'kantin_pusat', label: 'Kantin Pusat ITS' },
  { id: 'masjid_manarul', label: 'Masjid Manarul Ilmi ITS' },
  { id: 'perpustakaan_its', label: 'Perpustakaan ITS' },
  { id: 'research_center', label: 'Research Center ITS' },
  { id: 'taman_alumni', label: 'Taman Alumni ITS' },
  { id: 'taman_infinits', label: 'Taman Infinits' },
  { id: 'tower_1', label: 'Tower 1 ITS' },
  { id: 'tower_2', label: 'Tower 2 ITS' },
  { id: 'tower_3', label: 'Tower 3 ITS' },
] as const

export const CHECKOUT_MEETUP_LOCATIONS_WITH_OTHER = [
  ...CHECKOUT_MEETUP_LOCATIONS,
  { id: 'other', label: '✏️ Lainnya (isi manual)' },
] as const

export const RECOMMENDED_COD_LOCATIONS = [
  'CCWS IKOMA ITS',
  'Depan Rektorat ITS',
  'Kantin Pusat ITS',
  'Masjid Manarul Ilmi ITS',
  'Perpustakaan ITS',
  'Research Center ITS',
  'Taman Alumni ITS',
] as const