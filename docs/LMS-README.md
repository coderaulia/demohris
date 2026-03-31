# LMS Module - Learning Management System

**Status:** ✅ Sprint 1 Complete (Tasks 1.1-1.4)  
**Milestone:** v2.1.0-lms-alpha2  
**Last Updated:** 2026-03-31

---

## Overview

The Learning Management System (LMS) module provides comprehensive course management, enrollment tracking, progress monitoring, and certificate generation for employee training and development.

---

## Features Implemented

### ✅ Sprint 1: Course Management UI (Complete)

#### Task 1.1: Base Component Structure ✅

**Files Created:**
- `src/components/tab-lms.html` - Main LMS UI with 7 views
- `src/modules/lms.js` - Core LMS module (1121 lines)
- `docs/LMS-PROGRESS.md` - Progress tracker

**Features:**
- 7 pre-built views (My Learning, Catalog, My Courses, Certificates, Admin Courses, Admin Enrollments, Admin Reports)
- Role-based UI (employees see student view, admins see admin tools)
- Sidebar navigation with summary cards
- Bootstrap 5 responsive design

---

#### Task 1.2: Course Catalog with Search/Filters ✅

**Features:**
- Live search with 300ms debounce
- Filter by category (14 categories)
- Filter by difficulty level (Beginner/Intermediate/Advanced/Expert)
- Pagination (20 courses per page)
- Course cards with thumbnails
- Click-to-view course details
- Clear filters button
- Loading and error states

**Code:**
```javascript
// Search with debounce
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadCatalog(), 300);
});

// Filter controls
<select id="lms-catalog-category">
    <option value="">All Categories</option>
    <option value="General">General</option>
    <option value="Technical Skills">Technical Skills</option>
    // ... more categories
</select>
```

---

#### Task 1.3: Course Creation/Editing Modal ✅

**Form Fields:**
- Course title (required, 3-255 chars)
- Status (Draft/Published/Archived)
- Short description (max 500 chars)
- Full description (rich text with Quill.js)
- Category (dropdown)
- Difficulty level (dropdown)
- Duration in minutes
- Passing score percentage
- Max quiz attempts (0 = unlimited)
- Thumbnail URL
- Introduction video URL (YouTube support)
- Mandatory course checkbox
- Certificate generation checkbox

**Validation:**
- Title required and length validation
- Duration must be 0-6000 minutes
- Passing score must be 0-100
- Max attempts must be 0-10
- URL validation for thumbnail and video

**Code:**
```javascript
function showCourseFormModal(courseId = null) {
    // Load course data if editing
    // Generate form HTML
    // Initialize Quill editor
    // Show Bootstrap modal
}

function validateCourseForm(courseData) {
    const errors = [];
    if (!courseData.title || courseData.title.length < 3) {
        errors.push('Course title must be at least 3 characters long.');
    }
    // ... more validation
    return errors;
}
```

---

#### Task 1.4: Quill.js Rich Text Editor ✅

**Features:**
- Full toolbar with formatting options
- Headers (H1-H6)
- Bold, Italic, Underline, Strikethrough
- Text color and background
- Ordered and unordered lists
- Indentation and alignment
- Links, Images, Videos
- Clean formatting button

**Integration:**
```javascript
async function initializeQuillEditor(initialContent = '') {
    const editorElement = document.getElementById('course-description-editor');
    
    quillEditor = new Quill(editorElement, {
        theme: 'snow',
        placeholder: 'Write course description here...',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                // ... more toolbar options
            ]
        }
    });
    
    // Auto-save on text change
    quillEditor.on('text-change', () => {
        document.getElementById('course-quill-content').value = 
            quillEditor.root.innerHTML;
    });
}
```

---

## Architecture

### File Structure

```
src/
├── components/
│   └── tab-lms.html                 # Main LMS UI
├── modules/
│   ├── lms.js                       # Core LMS module
│   └── lms/
│       └── courseManager.js          # Course CRUD logic
└── data/
    └── lms.js                        # API client (scaffolded)
```

### Module Pattern

**Main Module** (`src/modules/lms.js`):
- View switching logic
- Navigation handling
- Data loading from API
- Event listeners
- Window exports for onclick handlers

**Sub-Module** (`src/modules/lms/courseManager.js`):
- Form generation
- Quill initialization
- Validation logic
- Render functions
- Pagination

**Data Layer** (`src/modules/data/lms.js`):
- API client functions (scaffolded, will be connected to backend)

---

## Views

### 1. My Learning (Student Dashboard)

**URL:** `/#/lms` (default view)

**Features:**
- Continue Learning cards
- In-progress courses table
- Recommended courses
- Enrollment statistics

**Components:**
- Summary cards (Enrolled, In Progress, Completed, Certificates)
- Progress bars
- Quick actions

---

### 2. Course Catalog

**URL:** `/#/lms` → Click "Course Catalog"

**Features:**
- Course grid layout
- Search bar
- Category filter
- Difficulty filter
- Pagination
- Course cards

**Actions:**
- Click card → View details
- Filter → Update results
- Clear filters → Reset

---

### 3. My Courses

**URL:** `/#/lms` → Click "My Courses"

**Features:**
- Enrolled courses list
- Status badges (Enrolled/In Progress/Completed)
- Progress tracking
- Certificate download buttons

---

### 4. Certificates

**URL:** `/#/lms` → Click "Certificates"

**Features:**
- Certificate cards
- Download links
- Issue dates

---

### 5. Admin - Manage Courses

**URL:** `/#/lms` → Click "Manage Courses" (Admin only)

**Features:**
- Course CRUD operations
- Status filter (Draft/Published/Archived)
- Search
- Create course button
- Edit/Delete buttons

---

### 6. Admin - Enrollments

**URL:** `/#/lms` → Click "Enrollments" (Admin only)

**Features:**
- Enrollment table
- Filter by status
- Employee tracking
- Bulk operations

---

### 7. Admin - Reports

**URL:** `/#/lms` → Click "Reports" (Admin only)

**Features:**
- Statistics cards
- Department charts
- Top courses
- Completion rates

---

## API Integration

### Backend Endpoints Required

All endpoints are documented in `docs/api/lms-api.md` (43 endpoints).

**Essential Endpoints:**

```javascript
// Course Management
lmsData.listCourses({ status, category, difficulty, search, page, limit })
lmsData.getCourse(courseId)
lmsData.createCourse(courseData)
lmsData.updateCourse(courseId, courseData)
lmsData.deleteCourse(courseId)

// Enrollment
lmsData.enrollInCourse(courseId)
lmsData.getMyCourses({ status, page, limit })

// Dashboard
lmsData.getDashboardStats()
lmsData.getRecommendations()
```

### Backend Implementation Status

**Status:** ✅ Backend fully implemented (`server/modules/lms.js` - 1491 lines)

All 43 API endpoints are ready and functional:
- Courses: 6 endpoints
- Sections: 5 endpoints
- Lessons: 6 endpoints
- Quizzes: 5 endpoints
- Enrollments: 6 endpoints
- Progress: 3 endpoints
- And more...

---

## Testing

### E2E Tests

**File:** `tests/e2e/lms-course-management.spec.js`

**Test Cases:**
1. ✅ Employee can view My Learning dashboard
2. ✅ Employee can browse course catalog
3. ✅ Admin can access course management
4. ✅ Admin can open create course modal
5. ✅ Employee cannot see admin-only elements
6. ✅ LMS navigation and view switching works correctly
7. ✅ Course catalog filters work

**Run Tests:**
```bash
# Set environment variables
export E2E_EMPLOYEE_EMAIL="farhan.demo@xenos.local"
export E2E_PASSWORD="Demo123!"

# Run LMS tests
npm run qa:e2e -- tests/e2e/lms-course-management.spec.js
```

---

## Usage Examples

### Create a Course (Admin)

```javascript
// Open create course modal
window.__app.showCourseDetails('course-id');

// Fill form and submit
// Form validates and calls: lmsData.createCourse(courseData)
```

### Browse Courses (All Users)

```javascript
// Navigate to catalog
window.__app.navigateTo('/lms');
// Click "Course Catalog"

// Apply filters
document.getElementById('lms-catalog-category').value = 'Technical Skills';
document.getElementById('lms-catalog-difficulty').value = 'beginner';
document.getElementById('lms-catalog-search').value = 'javascript';

// Results update automatically
```

### View Course Details

```javascript
// Open course details modal
window.__app.showCourseDetails('course-uuid');

// Click "Enroll Now"
// Calls: lmsData.enrollInCourse(courseId)
```

---

## Future Enhancements

### Sprint 2: Student Experience (Planned)

- Lesson viewer component
- Video/document player
- Progress tracking UI
- "My Learning" dashboard enhancements

### Sprint 3: Quiz Engine (Planned)

- Quiz-taking interface
- Multiple choice questions
- True/false questions
- Short answer questions
- Auto-grading
- Score display

### Sprint 4: Admin Features (Planned)

- Analytics dashboard
- Bulk course assignment
- Certificate generation (PDF)
- Learning paths builder

---

## Known Issues

None at this time.

---

## Contributing

When contributing to LMS module:

1. Follow existing code patterns in `src/modules/lms.js`
2. Add new features as sub-modules in `src/modules/lms/`
3. Keep API calls in `src/modules/data/lms.js`
4. Update `docs/LMS-PROGRESS.md`
5. Write E2E tests for new features
6. Update API documentation if adding endpoints

---

## Documentation

- **Progress Tracker:** `docs/LMS-PROGRESS.md`
- **API Documentation:** `docs/api/lms-api.md`
- **Database Schema:** `migrations/005_create_lms_tables.sql`
- **Backend Code:** `server/modules/lms.js` (1491 lines)

---

## Changelog

### v2.1.0-lms-alpha2 (2026-03-31)
- Course catalog with search/filters
- Course creation/editing modal
- Quill.js rich text editor
- Form validation
- Pagination support

### v2.1.0-lms-alpha1 (2026-03-31)
- Base component structure
- Navigation integration
- Role-based UI
- 7 views scaffolded

---

**Maintainer:** HR Performance Suite Team  
**Contact:** support@xenos.local  
**Repository:** https://github.com/xenosweb-org/hris-system