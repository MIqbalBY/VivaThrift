export const FACULTIES_DEPARTMENTS: Record<string, string[]> = {
  'Fakultas Desain Kreatif dan Bisnis Digital (FDKBD)': [
    'Desain Interior', 'Desain Komunikasi Visual', 'Desain Produk Industri',
    'Manajemen Bisnis', 'Studi Pembangunan',
  ],
  'Fakultas Kedokteran dan Kesehatan (FKK)': [
    'Kedokteran', 'Teknologi Kedokteran',
  ],
  'Fakultas Sains dan Analitika Data (FSAD)': [
    'Aktuaria', 'Biologi', 'Fisika', 'Kimia', 'Matematika', 'Statistika',
  ],
  'Fakultas Teknik Sipil, Perencanaan, dan Kebumian (FTSPK)': [
    'Arsitektur', 'Perencanaan Wilayah dan Kota', 'Teknik Geofisika',
    'Teknik Geomatika', 'Teknik Lingkungan', 'Teknik Sipil',
  ],
  'Fakultas Teknologi Elektro dan Informatika Cerdas (FTEIC)': [
    'Sistem Informasi', 'Teknik Biomedik', 'Teknik Elektro',
    'Teknik Informatika', 'Teknik Komputer', 'Teknik Telekomunikasi', 'Teknologi Informasi',
  ],
  'Fakultas Teknologi Industri dan Rekayasa Sistem (FTIRS)': [
    'Teknik dan Sistem Industri', 'Teknik Fisika', 'Teknik Kimia',
    'Teknik Material', 'Teknik Mesin', 'Teknik Pangan',
  ],
  'Fakultas Teknologi Kelautan (FTK)': [
    'Teknik Kelautan', 'Teknik Lepas Pantai', 'Teknik Perkapalan',
    'Teknik Sistem Perkapalan', 'Teknik Transportasi Laut',
  ],
  'Fakultas Vokasi (FV)': [
    'Statistika Bisnis', 'Teknik Elektro Otomasi', 'Teknik Infrastruktur Sipil',
    'Teknik Instrumentasi', 'Teknik Kimia Industri', 'Teknik Mesin Industri',
  ],
}

export function facultyAcronym(f: string) {
  if (!f) return ''
  const m = /\(([^)]+)\)$/.exec(f)
  return m ? m[1] : f
}
