import { Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import logo from '../assets/logo.png'
import api from '../lib/api'

import {
  ChartBarIcon,
  UserGroupIcon,
  DocumentTextIcon,
  CpuChipIcon,
  BellIcon,
  GlobeAltIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  PencilSquareIcon,
  BuildingOffice2Icon,
  SignalIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline'

import {
  FaFacebook,
  FaInstagram,
  FaGithub,
  FaYoutube,
  FaXTwitter
} from 'react-icons/fa6'

const BRAND = {
  green: '#10b981',
  blue: '#3b82f6'
}

const FAQs_LIST = [
  {
    question: "Who can submit a complaint or suggestion?",
    answer: "Any currently enrolled student at Hormuud University can submit complaints, feedback, or suggestions using their official student credentials."
  },
  {
    question: "How can I track the status of my complaint?",
    answer: "After submitting, you can track the status of your complaint on the 'Track Complaint' page using the unique tracking code or by logging in to your student dashboard."
  },
  {
    question: "How long does it take to get a response?",
    answer: "Most complaints are reviewed within 24–48 hours by the respective department. Depending on the complexity and priority, resolution may take 3–7 business days."
  },
  {
    question: "Is my complaint private and secure?",
    answer: "Yes, all submissions are treated with high confidentiality. Only authorized staff and department heads assigned to resolve your specific case have access to your details."
  },
  {
    question: "Can I edit or cancel my complaint after submitting?",
    answer: "Once a complaint is submitted and is being processed, it cannot be edited directly. However, you can add comments or request to cancel it from your tracking page."
  }
]

export default function ProgrammeHero() {
  const heroRef = useRef(null)
  const [isNavScrolled, setIsNavScrolled] = useState(false)
  const [openFaqIndex, setOpenFaqIndex] = useState(null)
  const [landingData, setLandingData] = useState({
    statuses: ['Pending', 'In Progress', 'Escalated', 'Resolved'],
    priorities: ['Low', 'Medium', 'High', 'Critical'],
    categories: []
  })

  const [targetStats, setTargetStats] = useState({
    complaints: 0,
    resolved: 0,
    satisfaction: 0
  })

  const [stats, setStats] = useState({
    complaints: 0,
    resolved: 0,
    satisfaction: 0
  })

  useEffect(() => {
    const fetchLandingData = async () => {
      try {
        const response = await api.get('/public/landing/')
        const payload = response.data || {}

        setLandingData({
          statuses: payload.statuses?.length
            ? payload.statuses
            : ['Pending', 'In Progress', 'Escalated', 'Resolved'],
          priorities: payload.priorities || [],
          categories: payload.categories || []
        })

        setTargetStats({
          complaints: Number(payload.stats?.complaints || 0),
          resolved: Number(payload.stats?.resolved || 0),
          satisfaction: Number(payload.stats?.satisfaction || 0)
        })
      } catch (error) {
        console.error('Error fetching landing data:', error)
      }
    }

    fetchLandingData()
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      const heroBottom = heroRef.current
        ? heroRef.current.offsetTop + heroRef.current.offsetHeight - 80
        : window.innerHeight - 80

      setIsNavScrolled(window.scrollY >= heroBottom)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [])

  useEffect(() => {
    const animatedItems = document.querySelectorAll('.reveal-on-scroll')

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.14, rootMargin: '0px 0px -48px 0px' }
    )

    animatedItems.forEach((item) => observer.observe(item))

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let i = 0
    const steps = 50

    const interval = setInterval(() => {
      i++

      const p = i / steps

      setStats({
        complaints: Math.floor(targetStats.complaints * p),
        resolved: Math.floor(targetStats.resolved * p),
        satisfaction: Math.floor(targetStats.satisfaction * p)
      })

      if (i >= steps) clearInterval(interval)
    }, 30)

    return () => clearInterval(interval)
  }, [targetStats])

  const statusList = landingData.statuses.length
    ? landingData.statuses.join(', ')
    : 'Pending, In Progress, Escalated, Resolved'

  const workflowSteps = [
    {
      step: '01',
      title: 'Login',
      desc: 'Student logs in securely using university ID and password.',
      tag: 'Authentication',
      icon: LockClosedIcon
    },
    {
      step: '02',
      title: 'Submit Complaint',
      desc: landingData.categories.length
        ? `Student writes the complaint; the system detects a category such as ${landingData.categories.slice(0, 3).join(', ')}.`
        : 'Student writes the complaint and the system detects the right category.',
      tag: 'Student Action',
      icon: PencilSquareIcon
    },
    {
      step: '03',
      title: 'Department Review',
      desc: 'The responsible office receives, checks, and processes the complaint.',
      tag: 'Office Review',
      icon: BuildingOffice2Icon
    },
    {
      step: '04',
      title: 'Track Status',
      desc: `Student follows the complaint status: ${statusList}.`,
      tag: 'Live Tracking',
      icon: SignalIcon
    },
    {
      step: '05',
      title: 'Resolved',
      desc: 'The complaint is completed and the final result is recorded.',
      tag: 'Final Stage',
      icon: CheckCircleIcon
    }
  ]

  const workflowTagStyles = {
    Authentication: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    'Student Action': 'border-blue-200 bg-blue-50 text-blue-700',
    'Office Review': 'border-[#2B85B7]/20 bg-[#EAF5FB] text-[#2B85B7]',
    'Live Tracking': 'border-[#e7d7b6] bg-[#fbf6ea] text-[#8c6b2e]',
    'Final Stage': 'border-[#ead0d0] bg-[#fbefef] text-[#9b5151]'
  }

  const features = [
    {
      icon: UserGroupIcon,
      title: 'Role Based Access',
      desc: 'Separate access for students, departments, and admins.'
    },
    {
      icon: CpuChipIcon,
      title: 'Smart Categorization',
      desc: 'Complaints can be organized by category, priority, and source.'
    },
    {
      icon: BellIcon,
      title: 'Status Updates',
      desc: 'Students can follow complaint progress from submission to resolution.'
    },
    {
      icon: ChartBarIcon,
      title: 'Reports Dashboard',
      desc: 'Admins can view complaint statistics and resolution progress.'
    },
    {
      icon: DocumentTextIcon,
      title: 'Complaint Tracking',
      desc: 'Each complaint has a unique code for easy tracking.'
    },
    {
      icon: GlobeAltIcon,
      title: 'Accessible Platform',
      desc: 'Students can submit and track complaints from anywhere.'
    }
  ]

  return (
    <div className="min-h-screen bg-[#081713] text-gray-900 relative overflow-hidden">
      {/* NAVBAR */}
      <nav
        className={`fixed left-0 top-0 z-50 w-full border-b px-4 backdrop-blur transition-colors duration-300 animate-fade-in-down ${
          isNavScrolled
            ? 'border-gray-200 bg-white/92'
            : 'border-white/10 bg-[#081713]/82'
        }`}
      >
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-xl border bg-white ${
                isNavScrolled ? 'border-gray-200' : 'border-white/12'
              }`}
            >
              <img
                src={logo}
                alt="Hormuud University"
                className="h-8 w-8 object-contain"
              />
            </span>

            <div className="leading-tight">
              <h1
                className={`text-sm font-semibold uppercase tracking-wide md:text-base ${
                  isNavScrolled ? 'text-gray-900' : 'text-white'
                }`}
              >
                Hormuud University
              </h1>
              <p
                className={`mt-0.5 hidden text-xs font-medium sm:block ${
                  isNavScrolled ? 'text-gray-500' : 'text-white/45'
                }`}
              >
                Student Support System
              </p>
            </div>
          </Link>

          <div
            className={`hidden items-center gap-7 text-sm font-medium md:flex ${
              isNavScrolled ? 'text-gray-700' : 'text-white'
            }`}
          >
            <a
              href="#how-it-works"
              className={`transition ${isNavScrolled ? 'hover:text-emerald-600' : 'hover:text-white'}`}
            >
              How It Works
            </a>

            <a
              href="#features"
              className={`transition ${isNavScrolled ? 'hover:text-emerald-600' : 'hover:text-white'}`}
            >
              Features
            </a>

            <a
              href="#faqs"
              className={`transition ${isNavScrolled ? 'hover:text-emerald-600' : 'hover:text-white'}`}
            >
              FAQs
            </a>

            <Link
              to="/student/complaints"
              className={`transition ${isNavScrolled ? 'hover:text-emerald-600' : 'hover:text-white'}`}
            >
              Track Complaint
            </Link>

            <Link
              to="/login"
              className="inline-flex h-10 w-auto px-6 items-center justify-center rounded-xl bg-emerald-400 px-5 text-sm font-semibold text-[#06110e] transition hover:bg-emerald-300"
            >
              Login
            </Link>
          </div>

          <Link
            to="/login"
            className="inline-flex h-10 w-auto px-6 items-center justify-center rounded-xl bg-emerald-400 px-5 text-sm font-semibold text-[#06110e] transition hover:bg-emerald-300 md:hidden"
          >
            Login
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section ref={heroRef} className="hero-dark-grid animate-hero-pan px-6 pb-20 pt-32 text-white md:pb-24 md:pt-36">
        <div className="hero-noise" />

        <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center text-center">
          

          

          <h1 className="max-w-5xl text-5xl font-semibold leading-[0.98] text-white sm:text-6xl md:text-7xl animate-fade-in-down">
            Send your complaint.
            <br />
            <span className="hero-highlight">Track the solution.</span>
          </h1>

          <p className="mt-8 max-w-3xl text-lg leading-9 text-white/72 md:text-xl md:leading-10 animate-fade-in-up animate-delay-100">
            Share your complaint, concern, or suggestion in Somali or English.
            Your message reaches the right office, stays visible through every
            stage, and is handled with respect until resolution.
          </p>

          <div className="mt-11 flex flex-col items-center justify-center gap-4 sm:flex-row animate-fade-in-up animate-delay-200">
              <Link
                to="/student/complaints/new"
                className="group inline-flex h-14 min-w-60 items-center justify-center rounded-2xl bg-emerald-500 px-8 text-sm font-bold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.18),0_18px_50px_rgba(16,185,129,0.32)] transition btn-animate hover:bg-emerald-600"
              >
                Send Your Complaint
                <ArrowRightIcon className="ml-2 h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
            

            <Link
              to="/student/complaints"
              className="inline-flex h-14 min-w-60 items-center justify-center rounded-2xl border border-white/70 bg-transparent px-8 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:border-white hover:bg-white/8"
            >
              Track Existing Case
            </Link>
          </div>

          <p className="hidden">
            You can write freely. We’ll guide your message to the right place.
          </p>

          

        </div>
      </section>

      {/* LIGHT CONTENT */}
      <div className="relative z-10 bg-white pt-16">
        <div className="mx-auto max-w-6xl px-6 pb-20">
         

          {/* HOW IT WORKS */}
          <div id="how-it-works" className="mt-20">
            <div className="reveal-on-scroll mb-12 grid gap-6 border-b border-gray-200 pb-10 md:grid-cols-[0.55fr_1fr] md:items-end">
              <p className="text-sm font-semibold uppercase tracking-[3px] text-emerald-600">
                How It Works
              </p>

              <div>
                <h2 className="text-3xl font-semibold leading-tight text-gray-900 md:text-4xl">
                  From complaint submission to resolution
                </h2>

                <p className="mt-4 max-w-2xl text-base leading-7 text-gray-700">
                  A clear student journey that shows how every complaint moves
                  through the system.
                </p>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="reveal-on-scroll border-l-2 border-emerald-500 pl-6">
                <p className="text-sm font-semibold uppercase tracking-[3px] text-emerald-600">
                  Student Journey
                </p>
                <h3 className="mt-4 max-w-sm text-2xl font-semibold leading-tight text-gray-900">
                  One clear path from the first message to the final outcome.
                </h3>
                <p className="mt-4 max-w-sm text-sm leading-7 text-gray-700">
                  Each complaint moves through a controlled process, so students
                  know where their case stands and staff know what action comes next.
                </p>

                <div className="mt-8 border-t border-gray-200 pt-6">
                  <p className="text-xs font-semibold uppercase tracking-[2px] text-gray-500">
                    Current status flow
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {landingData.statuses.length ? landingData.statuses.map((status) => (
                      <span
                        key={status}
                        className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600"
                      >
                        {status}
                      </span>
                    )) : null}
                  </div>
                </div>
              </div>

              <div className="border border-gray-200">
              {workflowSteps.map((item, index) => {
                const Icon = item.icon

                return (
                  <div
                    key={item.step}
                    className="reveal-on-scroll landing-row group grid gap-5 border-b border-gray-200 bg-white p-6 transition-colors last:border-b-0 hover:bg-slate-50 md:grid-cols-[72px_1fr]"
                    style={{ transitionDelay: `${index * 70}ms` }}
                  >
                    <div className="flex items-start gap-3 md:block">
                      <span className="block text-sm font-semibold text-emerald-600">
                        {item.step}
                      </span>
                      <div className="mt-3 flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white transition-colors group-hover:border-emerald-500/40">
                        <Icon className="h-5 w-5 text-emerald-600" />
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <h3 className="text-xl font-semibold text-gray-900">
                          {item.title}
                        </h3>

                        {item.tag ? (
                          <span
                            className={`w-fit rounded-full border px-3 py-1.5 text-xs font-semibold ${
                              workflowTagStyles[item.tag] || 'border-gray-200 bg-gray-50 text-gray-600'
                            }`}
                          >
                            {item.tag}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-2 max-w-2xl text-sm leading-7 text-gray-700">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                )
              })}
              </div>
            </div>
          </div>

          {/* FEATURES */}
          <div id="features" className="mt-24">
            <div className="reveal-on-scroll mb-12 grid gap-6 border-b border-gray-200 pb-10 md:grid-cols-[0.55fr_1fr] md:items-end">
              <p className="text-sm font-semibold uppercase tracking-[3px] text-emerald-600">
                Features
              </p>

              <div>
                <h2 className="text-3xl font-semibold leading-tight text-gray-900 md:text-4xl">
                  Tools designed for student complaint management
                </h2>

                <p className="mt-4 max-w-2xl text-base leading-7 text-gray-700">
                  Manage, track, and resolve student complaints faster with a clear
                  digital workflow for students, departments, and administrators.
                </p>
              </div>
            </div>

            <div className="grid border-t border-l border-gray-200 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => {
                const Icon = feature.icon

                return (
                  <div
                    key={index}
                    className="reveal-on-scroll border-r border-b border-gray-200 bg-white p-7"
                    style={{ transitionDelay: `${index * 55}ms` }}
                  >
                    <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200">
                      <Icon className="h-5 w-5 text-emerald-600" />
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900">
                      {feature.title}
                    </h3>

                    <p className="mt-3 text-sm leading-relaxed text-gray-700">
                      {feature.desc}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* FAQS */}
          <div id="faqs" className="mt-24">
            <div className="reveal-on-scroll mb-12 grid gap-6 border-b border-gray-200 pb-10 md:grid-cols-[0.55fr_1fr] md:items-end">
              <p className="text-sm font-semibold uppercase tracking-[3px] text-emerald-600">
                FAQ
              </p>

              <div>
                <h2 className="text-3xl font-semibold leading-tight text-gray-900 md:text-4xl">
                  Frequently Asked Questions
                </h2>

                <p className="mt-4 max-w-2xl text-base leading-7 text-gray-700">
                  Quick answers to common questions about the Student Support System,
                  submitting complaints, and tracking resolutions.
                </p>
              </div>
            </div>

            <div className="mx-auto max-w-4xl divide-y divide-gray-200">
              {FAQs_LIST.map((faq, index) => {
                const isOpen = openFaqIndex === index
                return (
                  <div
                    key={index}
                    className="reveal-on-scroll py-6 first:pt-0 last:pb-0"
                    style={{ transitionDelay: `${index * 50}ms` }}
                  >
                    <button
                      onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                      className="flex w-full items-center justify-between text-left font-semibold text-gray-900 transition hover:text-emerald-600 py-2 focus:outline-none"
                    >
                      <span className="text-lg md:text-xl pr-4">{faq.question}</span>
                      <ChevronDownIcon
                        className={`h-5 w-5 flex-shrink-0 text-gray-500 transition-transform duration-350 ${
                          isOpen ? 'rotate-180 text-emerald-600' : ''
                        }`}
                      />
                    </button>
                    <div
                      className={`overflow-hidden transition-all duration-350 ease-in-out ${
                        isOpen ? 'max-h-40 mt-3 opacity-100' : 'max-h-0 opacity-0'
                      }`}
                    >
                      <p className="text-base leading-7 text-gray-600">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* CTA */}
          <div className="reveal-on-scroll mt-24 border-y border-gray-200 py-14">
            <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[3px] text-emerald-600">
                  Student Support
                </p>
                <h2 className="mt-4 text-3xl font-semibold leading-tight text-gray-900 md:text-4xl">
                  Ready to submit or track a student complaint?
                </h2>

                <p className="mt-4 max-w-xl text-base leading-7 text-gray-700">
                  Login with your university account to submit a complaint and
                  follow its progress until it is resolved.
                </p>
              </div>

              <div className="flex flex-wrap gap-4 md:justify-end">
              <Link
                to="/student/complaints/new"
                className="inline-flex h-12 w-auto px-8 items-center justify-center rounded-lg bg-emerald-600 px-6 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Login to Submit
              </Link>

              <Link
                to="/student/complaints"
                className="inline-flex h-12 w-auto px-8 items-center justify-center rounded-lg border border-gray-300 px-6 text-sm font-semibold text-gray-900 transition hover:border-emerald-600 hover:text-emerald-600"
              >
                Track Complaint
              </Link>
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <footer className="reveal-on-scroll mt-24 border-t border-[#f3f4f6]">
            <div className="py-16">
              <div className="flex flex-wrap justify-center gap-8 text-lg text-gray-700">
                <a href="#how-it-works" className="transition hover:text-emerald-600">
                  How It Works
                </a>

                <a href="#features" className="transition hover:text-emerald-600">
                  Features
                </a>

                <a href="#faqs" className="transition hover:text-emerald-600">
                  FAQs
                </a>

                <Link to="/student/complaints" className="transition hover:text-emerald-600">
                  Track Complaint
                </Link>

                <a href="#" className="transition hover:text-emerald-600">
                  Complaint Policy
                </a>

                <a href="#" className="transition hover:text-emerald-600">
                  Privacy
                </a>

                <a href="#" className="transition hover:text-emerald-600">
                  Terms
                </a>
              </div>

              <div className="mt-12 flex justify-center gap-8 text-gray-500">
                <a href="#" className="text-3xl transition hover:text-emerald-600">
                  <FaFacebook />
                </a>

                <a href="#" className="text-3xl transition hover:text-emerald-600">
                  <FaInstagram />
                </a>

                <a href="#" className="text-3xl transition hover:text-emerald-600">
                  <FaXTwitter />
                </a>

                <a href="#" className="text-3xl transition hover:text-emerald-600">
                  <FaGithub />
                </a>

                <a href="#" className="text-3xl transition hover:text-emerald-600">
                  <FaYoutube />
                </a>
              </div>

              <div className="mt-14 text-center text-lg text-gray-500">
                © {new Date().getFullYear()} Hormuud University. All rights
                reserved.
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
