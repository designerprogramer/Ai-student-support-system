import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Send,
  Save,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  X,
  FileText,
  Image,
  File,
  UploadCloud
} from 'lucide-react'
import DashboardHeader, { dashboardHeaderSecondaryAction } from '../../components/DashboardHeader'
import api from '../../lib/api'
import { getAuthSession } from '../../lib/auth'

export default function NewComplaint() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [formData, setFormData] = useState({
    student_id: '',
    title: '',
    description: ''
  })
  const [attachments, setAttachments] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDraftSaving, setIsDraftSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const session = getAuthSession()

  const getApiErrorMessage = (payload) => {
    if (!payload) return ''
    if (typeof payload === 'string') return payload
    if (typeof payload.detail === 'string' && payload.detail.trim()) return payload.detail
    if (typeof payload.message === 'string' && payload.message.trim()) return payload.message

    const [firstKey] = Object.keys(payload)
    if (!firstKey) return ''

    const firstValue = payload[firstKey]
    if (Array.isArray(firstValue) && firstValue.length > 0) {
      return `${firstKey}: ${firstValue[0]}`
    }
    if (typeof firstValue === 'string' && firstValue.trim()) {
      return `${firstKey}: ${firstValue}`
    }
    return ''
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear messages when user starts typing
    if (error) setError('')
    if (success) setSuccess('')
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    const validFiles = []
    const invalidFiles = []

    files.forEach(file => {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        invalidFiles.push(`${file.name} (exceeds 5MB)`)
      } 
      // Check file type
      else if (!['image/jpeg', 'image/png', 'image/jpg', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
        invalidFiles.push(`${file.name} (unsupported format)`)
      }
      else {
        validFiles.push(file)
      }
    })

    if (invalidFiles.length > 0) {
      setError(`Invalid files: ${invalidFiles.join(', ')}. Allowed: JPG, PNG, PDF, DOC (max 5MB)`)
    }

    if (validFiles.length > 0) {
      const newAttachments = validFiles.map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      }))
      setAttachments(prev => [...prev, ...newAttachments])
      setError('')
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeAttachment = (id) => {
    setAttachments(prev => {
      const attachment = prev.find(a => a.id === id)
      if (attachment?.preview) {
        URL.revokeObjectURL(attachment.preview)
      }
      return prev.filter(a => a.id !== id)
    })
  }

  const getFileIcon = (fileType) => {
    if (fileType?.startsWith('image/')) return <Image size={16} />
    if (fileType === 'application/pdf') return <FileText size={16} />
    return <File size={16} />
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setIsSubmitting(true)

    try {
      const formDataToSend = new FormData()
      const studentId = (session?.user?.student_id || formData.student_id || '').trim()
      if (!studentId) {
        setError('Student ID is required before submitting a complaint.')
        setIsSubmitting(false)
        return
      }
      
      // Add form fields
      formDataToSend.append('student_id', studentId)
      formDataToSend.append('title', formData.title)
      formDataToSend.append('description', formData.description)
      
      // Add attachments
      attachments.forEach((attachment) => {
        formDataToSend.append(`attachments`, attachment.file)
      })

      await api.post('/complaints/', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      
      setSuccess('Complaint submitted successfully!')
      setTimeout(() => {
        navigate('/student/complaints')
      }, 1500)
    } catch (error) {
      const apiMessage = getApiErrorMessage(error.response?.data)
      setError(apiMessage || 'Failed to submit complaint. Please try again.')
      console.error('Error submitting complaint:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!formData.title && !formData.description && attachments.length === 0) {
      setError('Please add a title, description, or attachment before saving draft')
      return
    }

    setIsDraftSaving(true)
    setError('')
    setSuccess('')

    try {
      // For drafts, we can't store actual File objects in localStorage
      // Store metadata only, files would need to be handled separately
      const drafts = JSON.parse(localStorage.getItem('complaint_drafts') || '[]')
      const newDraft = {
        id: Date.now(),
        ...formData,
        attachments: attachments.map(a => ({
          name: a.name,
          size: a.size,
          type: a.type
        })),
        savedAt: new Date().toISOString()
      }
      drafts.push(newDraft)
      localStorage.setItem('complaint_drafts', JSON.stringify(drafts))
      setSuccess('Draft saved successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError('Failed to save draft')
    } finally {
      setIsDraftSaving(false)
    }
  }

  return (
    <div className="space-y-7">
      <DashboardHeader
        eyebrow="New Complaint"
        title="Submit a support request"
        description="Fill out the form below and our team will get back to you within 24 hours."
        actions={
          <button
            onClick={() => navigate('/student/complaints')}
            className={dashboardHeaderSecondaryAction}
            type="button"
          >
            <ChevronLeft size={18} />
            Back to complaints
          </button>
        }
      />

      {/* Success/Error Messages */}
      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle size={18} className="text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
          <CheckCircle2 size={18} className="text-green-500" />
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info Section */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-5">
            Basic Information
          </h2>
          
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Student ID <span className="text-red-500">*</span>
            </label>
            <input 
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-[#2B85B7] focus:outline-none focus:ring-1 focus:ring-[#2B85B7]"
              name="student_id"
              value={session?.user?.student_id || formData.student_id}
              onChange={handleChange}
              placeholder="Enter your student ID"
              required
              disabled={!!session?.user?.student_id}
            />
            {session?.user?.student_id && (
              <p className="mt-1 text-xs text-gray-400">Auto-filled from your profile</p>
            )}
          </div>
        </div>

        {/* Classification Section */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-5">
            Automatic Classification
          </h2>

          <div className="rounded-xl border border-[#e8e7ff] bg-[#f9f8ff] p-5">
            <p className="text-sm font-semibold text-gray-800">
              Category and priority will be detected automatically.
            </p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              The system reads the complaint title, description, language, urgency, and attachments, then routes it to the best category.
            </p>
          </div>
          <p className="mt-4 text-xs text-gray-500">
            Students do not need to choose a category manually.
          </p>
        </div>

        {/* Complaint Details Section */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-5">
            Complaint Details
          </h2>
          
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Title <span className="text-red-500">*</span>
              </label>
              <input 
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-[#2B85B7] focus:outline-none focus:ring-1 focus:ring-[#2B85B7]"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g., Issue with tuition fee payment"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea 
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-[#2B85B7] focus:outline-none focus:ring-1 focus:ring-[#2B85B7] resize-none"
                rows="6"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe your issue in Somali or English. Include what happened and important details."
                required
              />
              <p className="mt-2 text-xs text-gray-400">
                {formData.description.length} characters • Be as specific as possible for faster resolution
              </p>
            </div>
          </div>
        </div>

        {/* Attachments Section */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-5">
            Attachments
          </h2>
          
          {/* Upload Area */}
          <div 
            className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-[#2B85B7] transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
              onChange={handleFileSelect}
              className="hidden"
            />
            <UploadCloud size={40} className="mx-auto text-gray-400 mb-3" />
            <p className="text-sm text-gray-600">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Supports: JPG, PNG, PDF, DOC (Max 5MB per file)
            </p>
          </div>

          {/* Attachments List */}
          {attachments.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Attached files ({attachments.length})
              </p>
              {attachments.map((attachment) => (
                <div 
                  key={attachment.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {attachment.preview ? (
                      <img 
                        src={attachment.preview} 
                        alt={attachment.name}
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center text-[#2B85B7]">
                        {getFileIcon(attachment.type)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {attachment.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatFileSize(attachment.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(attachment.id)}
                    className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <X size={16} className="text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div className="flex flex-wrap gap-3">
          <button 
            className="flex items-center gap-2 rounded-xl bg-[#2B85B7] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2376A4] disabled:opacity-50 disabled:cursor-not-allowed"
            type="submit"
            disabled={isSubmitting}
          >
            <Send size={18} />
            {isSubmitting ? 'Submitting...' : 'Submit Complaint'}
          </button>
          
          <button 
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            type="button"
            onClick={handleSaveDraft}
            disabled={isDraftSaving}
          >
            <Save size={18} />
            {isDraftSaving ? 'Saving...' : 'Save as Draft'}
          </button>
        </div>
      </form>

      {/* Help Section */}
      <div className="mt-8 rounded-2xl bg-gray-50 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#2B85B7]">
            <AlertCircle size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Need immediate assistance?</h3>
            <p className="text-sm text-gray-600 mt-1">
              For urgent issues, please contact the support desk directly at{' '}
              <a href="tel:+252614142187" className="text-[#2B85B7] hover:underline">+252 614 142 187</a>
              {' '}or visit the student support office during working hours.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
