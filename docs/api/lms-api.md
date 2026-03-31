# LMS API Documentation

**Version:** 1.0.0  
**Last Updated:** 2026-03-31  
**Status:** 🟢 Active Backend

---

## Overview

The Learning Management System (LMS) API provides comprehensive endpoints for course management, student enrollments, lesson progress tracking, quiz submissions, and certificate generation.

**Base URL:** `/api`

**Authentication:** Session-based authentication required for all endpoints.

**Content-Type:** `application/json`

---

## Table of Contents

### Courses
1. [List Courses](#1-list-courses)
2. [Get Course](#2-get-course)
3. [Create Course](#3-create-course)
4. [Update Course](#4-update-course)
5. [Delete Course](#5-delete-course)
6. [Publish Course](#6-publish-course)

### Sections
7. [List Sections](#7-list-sections)
8. [Create Section](#8-create-section)
9. [Update Section](#9-update-section)
10. [Delete Section](#10-delete-section)
11. [Reorder Sections](#11-reorder-sections)

### Lessons
12. [List Lessons](#12-list-lessons)
13. [Get Lesson](#13-get-lesson)
14. [Create Lesson](#14-create-lesson)
15. [Update Lesson](#15-update-lesson)
16. [Delete Lesson](#16-delete-lesson)
17. [Reorder Lessons](#17-reorder-lessons)

### Quiz Questions
18. [List Questions](#18-list-questions)
19. [Create Question](#19-create-question)
20. [Update Question](#20-update-question)
21. [Delete Question](#21-delete-question)

### Enrollments
22. [List Enrollments](#22-list-enrollments)
23. [Enroll in Course](#23-enroll-in-course)
24. [Unenroll from Course](#24-unenroll-from-course)
25. [Get My Courses](#25-get-my-courses)
26. [Start Course](#26-start-course)
27. [Complete Course](#27-complete-course)

### Progress
28. [Update Lesson Progress](#28-update-lesson-progress)
29. [Get Lesson Progress](#29-get-lesson-progress)
30. [Complete Lesson](#30-complete-lesson)

### Quizzes
31. [Submit Quiz](#31-submit-quiz)
32. [Get Quiz Attempt](#32-get-quiz-attempt)

### Reviews
33. [List Reviews](#33-list-reviews)
34. [Create Review](#34-create-review)
35. [Update Review](#35-update-review)
36. [Delete Review](#36-delete-review)

### Dashboard
37. [Get Dashboard Stats](#37-get-dashboard-stats)
38. [Get Recommendations](#38-get-recommendations)

### Assignments
39. [Create Assignment](#39-create-assignment)
40. [List Assignments](#40-list-assignments)
41. [Complete Assignment](#41-complete-assignment)

### Certificates
42. [List Certificates](#42-list-certificates)
43. [Generate Certificate](#43-generate-certificate)

---

## Courses

### 1. List Courses

Retrieve a paginated list of courses with optional filters.

**Endpoint:** `POST /api/lms/courses/list`

**Authentication:** Required (All authenticated users)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | No | Filter by status: `draft`, `published`, `archived`. Default: `published` for non-admin |
| `category` | string | No | Filter by category |
| `difficulty_level` | string | No | Filter by difficulty: `beginner`, `intermediate`, `advanced`, `expert` |
| `search` | string | No | Search in title and description |
| `employee_id` | string | No | Get courses for specific employee |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20, max: 100) |

**Response:**

```json
{
  "success": true,
  "courses": [
    {
      "id": "uuid",
      "title": "Advanced Sales Techniques",
      "description": "Master complex sales scenarios...",
      "short_description": "Master complex sales scenarios",
      "thumbnail_url": "https://example.com/image.jpg",
      "category": "Sales",
      "tags": ["sales", "negotiation", "communication"],
      "difficulty_level": "advanced",
      "estimated_duration_minutes": 120,
      "author_employee_id": "emp-001",
      "author_name": "John Doe",
      "status": "published",
      "is_mandatory": false,
      "prerequisites": ["course-uuid-1", "course-uuid-2"],
      "competencies_covered": [
        {"competency": "Negotiation", "level_gain": 2}
      ],
      "passing_score": 75.00,
      "max_attempts": 0,
      "enrollment_count": 45,
      "completion_count": 32,
      "avg_score": 82.5,
      "avg_rating": 4.7,
      "created_at": "2026-03-15T10:00:00Z",
      "updated_at": "2026-03-30T08:30:00Z",
      "published_at": "2026-03-16T09:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

**Status Codes:**
- `200 OK` - Success
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Not authorized to view draft courses

**Role-Based Filtering:**
- **Employee/Manager:** Can only see `published` courses
- **HR/Superadmin:** Can see all courses (including `draft` and `archived`)

---

### 2. Get Course

Retrieve detailed information about a specific course.

**Endpoint:** `POST /api/lms/courses/get`

**Authentication:** Required

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `course_id` | string | Yes | Course UUID |

**Response:**

```json
{
  "success": true,
  "course": {
    "id": "uuid",
    "title": "Course Title",
    "description": "Full course description...",
    "short_description": "Short description",
    "thumbnail_url": "https://...",
    "category": "General",
    "tags": ["tag1", "tag2"],
    "difficulty_level": "beginner",
    "estimated_duration_minutes": 60,
    "author_employee_id": "emp-001",
    "author_name": "Jane Doe",
    "status": "published",
    "is_mandatory": false,
    "prerequisites": [],
    "competencies_covered": [],
    "passing_score": 70.00,
    "max_attempts": 0,
    "enrollment_count": 120,
    "completion_count": 95,
    "avg_score": 78.3,
    "avg_rating": 4.5,
    "sections": [
      {
        "id": "section-uuid",
        "title": "Introduction",
        "description": "Section description",
        "ordinal": 1,
        "lessons_count": 5,
        "lessons": [
          {
            "id": "lesson-uuid",
            "title": "Lesson 1",
            "content_type": "video",
            "video_duration_seconds": 600,
            "ordinal": 1
          }
        ]
      }
    ],
    "created_at": "2026-03-15T10:00:00Z",
    "updated_at": "2026-03-30T08:30:00Z"
  }
}
```

**Status Codes:**
- `200 OK` - Success
- `401 Unauthorized` - Authentication required
- `404 Not Found` - Course not found

---

### 3. Create Course

Create a new course (Admin only).

**Endpoint:** `POST /api/lms/courses/create`

**Authentication:** Required (HR, Manager, Superadmin)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Course title (max 255 chars) |
| `description` | text | No | Full description (rich text) |
| `short_description` | string | No | Short description (max 500 chars) |
| `thumbnail_url` | string | No | Thumbnail image URL |
| `category` | string | No | Category (default: 'General') |
| `tags` | array | No | Array of tags |
| `difficulty_level` | string | No | `beginner`, `intermediate`, `advanced`, `expert` |
| `estimated_duration_minutes` | number | No | Duration in minutes |
| `is_mandatory` | boolean | No | Mandatory flag |
| `prerequisites` | array | No | Array of course UUIDs |
| `competencies_covered` | array | No | Array of competency objects |
| `passing_score` | number | No | Passing score percentage (default: 70) |
| `max_attempts` | number | No | Max quiz attempts (0 = unlimited) |

**Response:**

```json
{
  "success": true,
  "course": {
    "id": "new-course-uuid",
    "title": "Course Title",
    "status": "draft",
    "created_at": "2026-03-31T12:00:00Z"
  }
}
```

**Status Codes:**
- `201 Created` - Course created successfully
- `400 Bad Request` - Invalid input data
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Not authorized (employee role)

---

### 4. Update Course

Update an existing course (Admin only).

**Endpoint:** `POST /api/lms/courses/update`

**Authentication:** Required (HR, Manager, Superadmin)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `course_id` | string | Yes | Course UUID to update |
| `title` | string | No | New title |
| `description` | text | No | New description |
| `short_description` | string | No | New short description |
| `thumbnail_url` | string | No | New thumbnail URL |
| `category` | string | No | New category |
| `tags` | array | No | New tags |
| `difficulty_level` | string | No | New difficulty level |
| `estimated_duration_minutes` | number | No | New duration |
| `is_mandatory` | boolean | No | New mandatory flag |
| `prerequisites` | array | No | New prerequisites |
| `competencies_covered` | array | No | New competencies |
| `passing_score` | number | No | New passing score |
| `max_attempts` | number | No | New max attempts |

**Response:**

```json
{
  "success": true,
  "course": {
    "id": "course-uuid",
    "title": "Updated Title",
    "updated_at": "2026-03-31T13:00:00Z"
  }
}
```

**Status Codes:**
- `200 OK` - Course updated successfully
- `400 Bad Request` - Invalid input data
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Not authorized
- `404 Not Found` - Course not found

---

### 5. Delete Course

Delete a course (Superadmin only).

**Endpoint:** `POST /api/lms/courses/delete`

**Authentication:** Required (Superadmin)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `course_id` | string | Yes | Course UUID to delete |

**Response:**

```json
{
  "success": true,
  "message": "Course deleted successfully"
}
```

**Status Codes:**
- `200 OK` - Course deleted
- `400 Bad Request` - Cannot delete course with enrollments
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Not authorized (must be superadmin)
- `404 Not Found` - Course not found

---

### 6. Publish Course

Publish a draft course (Admin only).

**Endpoint:** `POST /api/lms/courses/publish`

**Authentication:** Required (HR, Manager, Superadmin)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `course_id` | string | Yes | Course UUID to publish |

**Response:**

```json
{
  "success": true,
  "course": {
    "id": "course-uuid",
    "status": "published",
    "published_at": "2026-03-31T14:00:00Z"
  }
}
```

**Status Codes:**
- `200 OK` - Course published
- `400 Bad Request` - Course has no sections/lessons
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Not authorized

---

## Sections

### 7. List Sections

List all sections for a course.

**Endpoint:** `POST /api/lms/sections/list`

**Authentication:** Required

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `course_id` | string | Yes | Course UUID |

**Response:**

```json
{
  "success": true,
  "sections": [
    {
      "id": "section-uuid",
      "course_id": "course-uuid",
      "title": "Section 1",
      "description": "Section description",
      "ordinal": 1,
      "lessons_count": 5,
      "created_at": "2026-03-15T10:00:00Z"
    }
  ]
}
```

---

### 8-11. Section Endpoints

Similar pattern to courses with Create, Update, Delete, and Reorder endpoints.

---

## Lessons

### 12-17. Lesson Endpoints

Full CRUD operations for lessons including:
- List, Get, Create, Update, Delete, Reorder
- Support for various content types: `video`, `document`, `quiz`, `scorm`, `text`, `external`, `practice`

---

## Quiz Questions

### 18-21. Question Endpoints

Quiz question management including:
- Multiple choice, True/False, Multiple select, Short answer, Matching
- Auto-grading support
- Points and explanations

---

## Enrollments

### 22-27. Enrollment Endpoints

Student enrollment lifecycle:
- Enroll, Unenroll
- My Courses list
- Start Course
- Complete Course
- Status tracking: `enrolled`, `in_progress`, `completed`, `failed`, `expired`

---

## Progress

### 28-30. Progress Endpoints

Progress tracking:
- Update lesson progress
- Get lesson progress
- Auto-complete lessons

---

## Quiz Submissions

### 31-32. Quiz Endpoints

Quiz attempt management:
- Submit quiz
- Get attempt details
- Score calculation

---

## Reviews

### 33-36. Review Endpoints

Course reviews and ratings:
- Create, Read, Update, Delete
- Rating: 1-5 stars
- Text reviews

---

## Dashboard

### 37. Get Dashboard Stats

Get learning dashboard statistics.

**Endpoint:** `POST /api/lms/dashboard/stats`

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "total_enrolled": 15,
  "in_progress": 8,
  "completed": 5,
  "certificates": 3,
  "avg_score": 78.5
}
```

---

### 38. Get Recommendations

Get personalized course recommendations.

**Endpoint:** `POST /api/lms/dashboard/recommendations`

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "recommendations": [
    {
      "id": "course-uuid",
      "title": "Recommended Course",
      "short_description": "...",
      "difficulty_level": "intermediate",
      "estimated_duration_minutes": 90,
      "relevance_score": 0.95
    }
  ]
}
```

---

## Assignments

### 39-41. Assignment Endpoints

Admin course assignment to employees:
- Create assignment (with due date, priority)
- List assignments
- Mark as complete/acknowledged

---

## Certificates

### 42. List Certificates

List certificates for the current user.

**Endpoint:** `POST /api/lms/certificates/list`

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "certificates": [
    {
      "id": "cert-uuid",
      "course_id": "course-uuid",
      "course_title": "Course Name",
      "employee_id": "emp-001",
      "certificate_number": "CERT-2026-00123",
      "issued_at": "2026-03-31T10:00:00Z",
      "valid_until": null,
      "certificate_url": "https://..."
    }
  ]
}
```

---

### 43. Generate Certificate

Generate a certificate for a completed course.

**Endpoint:** `POST /api/lms/certificates/generate`

**Authentication:** Required

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `enrollment_id` | string | Yes | Enrollment UUID |

**Response:**

```json
{
  "success": true,
  "certificate": {
    "id": "cert-uuid",
    "certificate_number": "CERT-2026-00124",
    "certificate_url": "https://..."
  }
}
```

---

## Error Responses

All endpoints follow a consistent error format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": "Additional context"
}
```

**Common Error Codes:**
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Invalid input
- `DUPLICATE_ENTRY` - Resource already exists
- `DEPENDENCY_ERROR` - Cannot delete due to dependencies

---

## Rate Limiting

- **Standard endpoints:** 100 requests/minute
- **Write endpoints:** 30 requests/minute

Rate limit headers included in responses:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

---

## Webhooks (Future)

Planned webhook events:
- `enrollment.created`
- `enrollment.completed`
- `certificate.generated`
- `course.published`

---

## Future Enhancements

1. **Bulk Operations**
   - Bulk enroll employees
   - Bulk course assignment
   - Bulk progress update

2. **Learning Paths**
   - Create learning paths
   - Assign paths to employees
   - Track path completion

3. **Gamification**
   - Badges
   - Points
   - Leaderboards

4. **Advanced Analytics**
   - Time spent per lesson
   - Quiz attempt analytics
   - Dropout points

---

**Last Updated:** 2026-03-31  
**Maintainer:** HR Performance Suite Team  
**Contact:** support@xenos.local