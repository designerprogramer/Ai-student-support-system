export const stats = [
  { label: 'Open complaints', value: '128', accent: 'text-ink', hint: '27 waiting for first response' },
  { label: 'Escalated cases', value: '14', accent: 'text-rose', hint: '4 require action before noon' },
  { label: 'Average response', value: '2h 18m', accent: 'text-amber', hint: 'Down 18% from last week' },
  { label: 'Resolved today', value: '37', accent: 'text-sage', hint: 'Most closures came from finance and housing' }
]

export const complaints = [
  {
    id: 'CMP-2026-000231',
    student: 'Amina Otieno',
    category: 'Finance',
    priority: 'High',
    status: 'In Progress',
    source: 'Web',
    updated: 'Today 08:45'
  },
  {
    id: 'CMP-2026-000230',
    student: 'Brian K. Mwangi',
    category: 'Housing',
    priority: 'Critical',
    status: 'Escalated',
    source: 'Walk-in',
    updated: 'Today 08:12'
  },
  {
    id: 'CMP-2026-000229',
    student: 'Lina Yusuf',
    category: 'IT Services',
    priority: 'Medium',
    status: 'Pending',
    source: 'Email',
    updated: 'Yesterday 17:10'
  },
  {
    id: 'CMP-2026-000228',
    student: 'David Kimani',
    category: 'Academics',
    priority: 'Low',
    status: 'Resolved',
    source: 'WhatsApp',
    updated: 'Yesterday 15:42'
  }
]

export const timeline = [
  { title: 'Complaint logged', time: 'Apr 14, 2026 08:10', note: 'Web form submitted by student with initial finance details.' },
  { title: 'Assigned to Housing', time: 'Apr 14, 2026 08:20', note: 'Auto-assigned based on category rules and active staff availability.' },
  { title: 'Status updated', time: 'Apr 14, 2026 08:45', note: 'Moved to In Progress with an acknowledgement sent to the student.' }
]
