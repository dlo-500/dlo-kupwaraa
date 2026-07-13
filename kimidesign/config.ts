export interface SiteConfig {
  language: string
  siteTitle: string
  siteDescription: string
}

export interface NavLink {
  label: string
  targetId: string
}

export interface NavigationConfig {
  brandMark: string
  links: NavLink[]
}

export interface HeroConfig {
  wordmarkText: string
  eyebrow: string
  titleLine1: string
  titleLine2: string
  descriptionLine1: string
  descriptionLine2: string
  ctaText: string
  ctaTargetId: string
}

export interface PhilosophyConfig {
  eyebrow: string
  title: string
  body: string
  rollingWords: string[]
}

export interface ProjectMeta {
  label: string
  value: string
}

export interface ProjectData {
  id: string
  title: string
  location: string
  year: string
  image: string
  subtitle: string
  meta: ProjectMeta[]
  paragraphs: string[]
}

export interface GalleryConfig {
  sectionLabel: string
  title: string
  projects: ProjectData[]
}

export interface MediumItem {
  cn: string
  en: string
  description: string
}

export interface MediumsConfig {
  sectionLabel: string
  items: MediumItem[]
}

export interface FooterEntry {
  text: string
  href?: string
}

export interface FooterColumn {
  heading: string
  entries: FooterEntry[]
}

export interface FooterConfig {
  visionText: string
  brandName: string
  columns: FooterColumn[]
  copyright: string
  videoPath: string
}

export interface ProjectDetailConfig {
  backLabel: string
}

export interface ServiceCard {
  icon: string
  title: string
  description: string
  tag: string
}

export interface TeamMember {
  name: string
  role: string
  icon: string
  subtitle: string
}

export interface StatItem {
  value: string
  label: string
  icon: string
}

export interface ContactInfo {
  icon: string
  title: string
  lines: string[]
}

export interface CourtInfo {
  name: string
  cases: number
}

export const siteConfig: SiteConfig = {
  language: "en",
  siteTitle: "District Litigation Office Kupwara",
  siteDescription: "District Litigation Office Kupwara — Official Case Management Portal. Track court cases, upcoming hearings, and litigation statistics for Kupwara district.",
}

export const navigationConfig: NavigationConfig = {
  brandMark: "DLO",
  links: [
    { label: "Home", targetId: "hero-section" },
    { label: "About", targetId: "about" },
    { label: "Cases", targetId: "live-data" },
    { label: "Courts", targetId: "courts" },
    { label: "Contact", targetId: "contact" },
  ],
}

export const heroConfig: HeroConfig = {
  wordmarkText: "DLO KUPWARA",
  eyebrow: "Government of Jammu & Kashmir",
  titleLine1: "Empowering Good",
  titleLine2: "Governance Through Law",
  descriptionLine1: "The District Litigation Office manages, monitors, and coordinates",
  descriptionLine2: "all government litigation across the courts of Kupwara district.",
  ctaText: "Explore Cases",
  ctaTargetId: "philosophy",
}

export const philosophyConfig: PhilosophyConfig = {
  eyebrow: "Our Philosophy",
  title: "Strategy. Precision. Justice.",
  body: "Every case is a move on the board — studied, deliberate, and purposeful. We provide legal representation and litigation management on behalf of government departments across all courts in Kupwara district.",
  rollingWords: ["JUSTICE", "INTEGRITY", "LAW", "STRATEGY", "PRECISION", "GOVERNANCE"],
}

export const galleryConfig: GalleryConfig = {
  sectionLabel: "LEGAL SERVICES / 002",
  title: "Areas of Practice",
  projects: [
    {
      id: "civil-litigation",
      title: "Civil Litigation",
      location: "Kupwara",
      year: "2024",
      image: "images/project-1.jpg",
      subtitle: "Property disputes, land acquisition, and civil suits",
      meta: [
        { label: "TYPE", value: "Civil Matters" },
        { label: "DEPT", value: "Revenue, PWD, Forest" },
        { label: "COURTS", value: "All District Courts" },
      ],
      paragraphs: [
        "Property disputes, land acquisition, mutation challenges and civil suits against government departments. Our office handles a wide range of civil litigation matters protecting government interests.",
        "We coordinate with departments including Revenue, Public Works, and Forest to ensure robust legal defence and timely compliance with court orders across all district courts.",
      ],
    },
    {
      id: "labour-service",
      title: "Labour & Service",
      location: "Kupwara",
      year: "2024",
      image: "images/project-2.jpg",
      subtitle: "Service matters and labour disputes",
      meta: [
        { label: "TYPE", value: "Service Matters" },
        { label: "DEPT", value: "Labour, Education" },
        { label: "COURTS", value: "Labour Court, HC" },
      ],
      paragraphs: [
        "Handling service matters related to government employees, labour disputes, and employment-related litigation across various departments including Labour, Education, and Health.",
        "We ensure proper legal representation in service commission matters, disciplinary proceedings, and wrongful termination cases.",
      ],
    },
    {
      id: "mact-claims",
      title: "MACT Claims",
      location: "Kupwara",
      year: "2024",
      image: "images/project-3.jpg",
      subtitle: "Motor accident compensation claims",
      meta: [
        { label: "TYPE", value: "Motor Claims" },
        { label: "DEPT", value: "Transport, Insurance" },
        { label: "COURTS", value: "MACT" },
      ],
      paragraphs: [
        "Motor Accident Claims Tribunal matters involving government vehicles, compensation claims, and insurance disputes. We represent government departments in MACT proceedings.",
        "Our team manages documentation, evidence collection, and court appearances for all motor accident related litigation.",
      ],
    },
    {
      id: "court-coordination",
      title: "Court Coordination",
      location: "Kupwara",
      year: "2024",
      image: "images/project-4.jpg",
      subtitle: "Liaison across all district courts",
      meta: [
        { label: "TYPE", value: "Coordination" },
        { label: "COURTS", value: "12+ Courts" },
        { label: "COVERAGE", value: "Full District" },
      ],
      paragraphs: [
        "Coordinating timely representation and compliance across all 12 courts in the district. From Sessions Court to MACT and DLSA, we ensure seamless legal operations.",
        "Our office maintains active liaison with judicial officers, court staff, and standing counsel to ensure efficient case management.",
      ],
    },
  ],
}

export const mediumsConfig: MediumsConfig = {
  sectionLabel: "OUR OPERATIONS",
  items: [
    {
      cn: "Cases",
      en: "CASE MANAGEMENT",
      description: "Real-time tracking of active cases across all courts in Kupwara district with comprehensive filtering and analytics.",
    },
    {
      cn: "Courts",
      en: "COURT COORDINATION",
      description: "Liaising with all district courts from Sessions Court to MACT and DLSA for seamless legal representation.",
    },
    {
      cn: "Hearings",
      en: "HEARING SCHEDULE",
      description: "Automated tracking of upcoming hearings with date-range filters and WhatsApp sharing capabilities.",
    },
    {
      cn: "Analytics",
      en: "PERFORMANCE ANALYTICS",
      description: "Data-driven insights into disposal rates, department performance, and counsel effectiveness.",
    },
    {
      cn: "History",
      en: "CASE HISTORY",
      description: "Complete chronological proceedings history for every case with downloadable reports.",
    },
  ],
}

export const footerConfig: FooterConfig = {
  visionText: "Committed to transparent, timely and effective legal representation. The District Litigation Office Kupwara stands as a pillar of good governance through strategic litigation management across all courts of the district.",
  brandName: "DLO Kupwara",
  columns: [
    {
      heading: "NAVIGATE",
      entries: [
        { text: "About the Office", href: "#about" },
        { text: "Legal Services", href: "#gallery" },
        { text: "Filter Cases", href: "#live-data" },
        { text: "Upcoming Hearings", href: "#hearings" },
        { text: "Court-wise Cases", href: "#courts" },
        { text: "Contact Us", href: "#contact" },
      ],
    },
    {
      heading: "COURTS",
      entries: [
        { text: "Sessions Court Kupwara", href: "#" },
        { text: "Sub Judge Court Kupwara", href: "#" },
        { text: "CJM Court Handwara", href: "#" },
        { text: "Additional Sessions Court", href: "#" },
        { text: "Munsiff Court Sogam", href: "#" },
      ],
    },
    {
      heading: "CONTACT",
      entries: [
        { text: "District Litigation Office Kupwara\n1st Floor DC Office Complex\nKupwara, J&K — 193222" },
        { text: "districtlitigationofficekupwar@gmail.com", href: "mailto:districtlitigationofficekupwar@gmail.com" },
      ],
    },
  ],
  copyright: "© 2026 District Litigation Office Kupwara. Government of Jammu & Kashmir.",
  videoPath: "",
}

export const projectDetailConfig: ProjectDetailConfig = {
  backLabel: "\u2190 Back",
}

export const servicesData: ServiceCard[] = [
  {
    icon: "\uD83C\uDFE0",
    title: "Civil Litigation",
    description: "Property disputes, land acquisition, mutation challenges and civil suits against government departments.",
    tag: "Revenue \u00B7 PWD \u00B7 Forest",
  },
  {
    icon: "\uD83D\uDC77",
    title: "Labour & Service Matters",
    description: "Service matters, labour disputes, and employment-related litigation for government departments.",
    tag: "Labour \u00B7 Education \u00B7 Health",
  },
  {
    icon: "\uD83D\uDE97",
    title: "MACT & Motor Claims",
    description: "Motor Accident Claims Tribunal matters involving government vehicles and compensation claims.",
    tag: "MACT \u00B7 Insurance \u00B7 PWD",
  },
  {
    icon: "\uD83C\uDF33",
    title: "Forest & Environment",
    description: "Environmental litigation, forest protection cases, and conservation-related legal matters.",
    tag: "Forest \u00B7 Environment",
  },
  {
    icon: "\uD83D\uDCDC",
    title: "Revenue Matters",
    description: "Land revenue cases, mutation disputes, and matters related to patwari and tehsildar operations.",
    tag: "Revenue \u00B7 Patwari \u00B7 Tehsildar",
  },
  {
    icon: "\uD83C\uDFDB\uFE0F",
    title: "Court Coordination",
    description: "Coordinating timely representation and compliance across all 12+ courts in the district.",
    tag: "All Courts",
  },
]

export const teamData: TeamMember[] = [
  {
    name: "Ishfaq Ahmad Khan",
    role: "District Litigation Officer",
    icon: "\u2696\uFE0F",
    subtitle: "District Litigation Officer",
  },
  {
    name: "Adv. Zubair Ahmad Wani",
    role: "Standing Counsel",
    icon: "\uD83D\uDC68\u200D\u2696\uFE0F",
    subtitle: "Standing Counsel",
  },
  {
    name: "Adv. Wasim Nazir Khan",
    role: "Standing Counsel",
    icon: "\uD83D\uDC68\u200D\u2696\uFE0F",
    subtitle: "Standing Counsel",
  },
]

export const contactData: ContactInfo[] = [
  {
    icon: "\uD83C\uDFDB\uFE0F",
    title: "Office Address",
    lines: [
      "District Litigation Office Kupwara",
      "1st Floor DC Office Complex, Kupwara",
      "Jammu & Kashmir \u2014 193222",
    ],
  },
  {
    icon: "\uD83D\uDCDE",
    title: "Phone",
    lines: ["+91 \u2014 XXXX \u2014 XXXXXX"],
  },
  {
    icon: "\uD83D\uDCE7",
    title: "Email",
    lines: ["districtlitigationofficekupwar@gmail.com"],
  },
  {
    icon: "\uD83D\uDD50",
    title: "Office Hours",
    lines: [
      "Monday to Saturday: 10:00 AM \u2013 5:00 PM",
      "Excluding Public Holidays",
    ],
  },
]

export const SUPABASE_URL = 'https://ibicsdsehxlsaygjnefk.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliaWNzZHNlaHhsc2F5Z2puZWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MjQxOTgsImV4cCI6MjA5OTAwMDE5OH0.VzI27sIsfb5AOOhF1zOmaeJPuoE0AnrzeavxWCWElsU'

export function getProjectById(id: string): ProjectData | undefined {
  return galleryConfig.projects.find((p) => p.id === id)
}
