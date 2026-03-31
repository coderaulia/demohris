// ==================================================
// LMS QUIZ - Quiz Taking and Grading
// ==================================================

import { state, emit } from '../../lib/store.js';
import { escapeHTML } from '../../lib/utils.js';
import * as notify from '../../lib/notify.js';
import * as lmsData from '../data/lms.js';

let currentQuiz = null;
let currentQuestions = [];
let currentAnswers = {};
let currentAttempt = null;
let quizEnrollment = null;

// ==================================================
// QUIZ MODAL
// ==================================================

async function startQuiz(lessonId, enrollment) {
    try {
        quizEnrollment = enrollment;
        
        notify.info('Loading quiz...');
        
        // Get lesson with quiz questions
        const lesson = await lmsData.getLesson(lessonId);
        
        if (!lesson || lesson.content_type !== 'quiz') {
            notify.error('This lesson is not a quiz');
            return;
        }
        
        // Get questions for the quiz
        const questionsResponse = await lmsData.listQuestions(lessonId);
        currentQuestions = questionsResponse.questions || [];
        
        if (currentQuestions.length === 0) {
            notify.error('This quiz has no questions');
            return;
        }
        
        currentQuiz = lesson;
        currentAnswers = {};
        
        // Get previous attempts if any
        const attemptsResponse = await lmsData.getQuizAttempts(lessonId, enrollment.id);
        const previousAttempts = attemptsResponse.attempts || [];
        
        // Show quiz modal
        const modalHtml = generateQuizModalHTML(lesson, currentQuestions, previousAttempts);
        showQuizModal(modalHtml);
        
        notify.close();
        
    } catch (error) {
        console.error('Failed to start quiz:', error);
        notify.error('Failed to load quiz: ' + (error.message || 'Unknown error'));
    }
}

function generateQuizModalHTML(lesson, questions, previousAttempts) {
    const attemptCount = previousAttempts.length;
    const passedAttempts = previousAttempts.filter(a => a.passed);
    const hasPassed = passedAttempts.length > 0;
    
    return `
        <div class="modal fade" id="quiz-modal" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog modal-xl modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title">
                            <i class="bi bi-question-circle me-2"></i>
                            ${escapeHTML(lesson.title)}
                        </h5>
                        <div class="d-flex align-items-center gap-2">
                            ${hasPassed ? `
                                <span class="badge bg-success">
                                    <i class="bi bi-check-circle me-1"></i>Passed
                                </span>
                            ` : `
                                <span class="badge bg-light text-dark">
                                    Attempt ${attemptCount + 1}
                                </span>
                            `}
                            <span class="badge bg-light text-dark">
                                ${questions.length} Questions
                            </span>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                    </div>
                    <div class="modal-body">
                        ${hasPassed ? `
                            <div class="alert alert-success">
                                <i class="bi bi-check-circle me-2"></i>
                                You have already passed this quiz with a score of <strong>${passedAttempts[0].score}%</strong>
                            </div>
                        ` : ''}
                        
                        <div class="quiz-progress mb-4">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <span>Question <span id="current-question-num">1</span> of ${questions.length}</span>
                                <span id="quiz-progress-percent">0%</span>
                            </div>
                            <div class="progress" style="height: 8px;">
                                <div class="progress-bar bg-primary" id="quiz-progress-bar" style="width: 0%"></div>
                            </div>
                        </div>
                        
                        <form id="quiz-form">
                            <div id="questions-container">
                                ${questions.map((q, index) => renderQuestion(q, index)).join('')}
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <div class="me-auto">
                            <button type="button" class="btn btn-outline-secondary" id="prev-question-btn" onclick="window.__appQuiz.prevQuestion()" disabled>
                                <i class="bi bi-chevron-left me-1"></i> Previous
                            </button>
                        </div>
                        <div class="d-flex gap-2">
                            <button type="button" class="btn btn-outline-secondary" id="next-question-btn" onclick="window.__appQuiz.nextQuestion()">
                                Next <i class="bi bi-chevron-right ms-1"></i>
                            </button>
                            <button type="button" class="btn btn-success d-none" id="submit-quiz-btn" onclick="window.__appQuiz.submitQuiz()">
                                <i class="bi bi-check-circle me-1"></i> Submit Quiz
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderQuestion(question, index) {
    const questionNum = index + 1;
    const isFirst = index === 0;
    
    let answerHTML = '';
    
    switch (question.question_type) {
        case 'multiple_choice':
            answerHTML = renderMultipleChoice(question, index);
            break;
        case 'true_false':
            answerHTML = renderTrueFalse(question, index);
            break;
        case 'multiple_select':
            answerHTML = renderMultipleSelect(question, index);
            break;
        case 'short_answer':
            answerHTML = renderShortAnswer(question, index);
            break;
        case 'matching':
            answerHTML = renderMatching(question, index);
            break;
        default:
            answerHTML = renderMultipleChoice(question, index);
    }
    
    return `
        <div class="question-card ${isFirst ? '' : 'd-none'}" 
             id="question-${index}" 
             data-question-index="${index}"
             data-question-type="${question.question_type}">
            <div class="card">
                <div class="card-header bg-light">
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="badge bg-primary">Question ${questionNum}</span>
                        <span class="text-muted">${question.points || 1} point${(question.points || 1) !== 1 ? 's' : ''}</span>
                    </div>
                </div>
                <div class="card-body">
                    <h5 class="card-title mb-4">${escapeHTML(question.question_text)}</h5>
                    ${answerHTML}
                </div>
            </div>
        </div>
    `;
}

function renderMultipleChoice(question, index) {
    const options = question.options || [];
    
    return `
        <div class="quiz-options">
            ${options.map((opt, optIndex) => `
                <div class="form-check mb-3">
                    <input class="form-check-input" type="radio" 
                           name="question-${index}" 
                           id="q${index}-opt-${optIndex}" 
                           value="${escapeHTML(typeof opt === 'string' ? opt : opt.value || opt.label)}"
                           onchange="window.__appQuiz.saveAnswer(${index}, this.value)">
                    <label class="form-check-label w-100 p-2 rounded" 
                           for="q${index}-opt-${optIndex}"
                           style="cursor: pointer;">
                        <span class="option-letter me-2">${String.fromCharCode(65 + optIndex)}</span>
                        ${escapeHTML(typeof opt === 'string' ? opt : opt.label || opt.value)}
                    </label>
                </div>
            `).join('')}
        </div>
    `;
}

function renderTrueFalse(question, index) {
    return `
        <div class="quiz-options">
            <div class="form-check mb-3">
                <input class="form-check-input" type="radio" 
                       name="question-${index}" 
                       id="q${index}-true" 
                       value="true"
                       onchange="window.__appQuiz.saveAnswer(${index}, 'true')">
                <label class="form-check-label w-100 p-2 rounded"for="q${index}-true" style="cursor: pointer;">
                    <i class="bi bi-check-circle text-success me-2"></i> True
                </label>
            </div>
            <div class="form-check mb-3">
                <input class="form-check-input" type="radio" 
                       name="question-${index}" 
                       id="q${index}-false" value="false"
                       onchange="window.__appQuiz.saveAnswer(${index}, 'false')">
                <label class="form-check-label w-100 p-2 rounded" 
                       for="q${index}-false" style="cursor: pointer;">
                    <i class="bi bi-x-circle text-danger me-2"></i> False
                </label>
            </div>
        </div>
    `;
}

function renderMultipleSelect(question, index) {
    const options = question.options || [];
    
    return `
        <div class="quiz-options">
            <p class="text-muted small mb-3">
                <i class="bi bi-info-circle me-1"></i>
                Select all that apply
            </p>
            ${options.map((opt, optIndex) => `
                <div class="form-check mb-3">
                    <input class="form-check-input" type="checkbox" 
                           name="question-${index}" 
                           id="q${index}-opt-${optIndex}" 
                           value="${escapeHTML(typeof opt === 'string' ? opt : opt.value || opt.label)}"
                           onchange="window.__appQuiz.saveMultiAnswer(${index}, ${optIndex}, this.checked)">
                    <label class="form-check-label w-100 p-2 rounded" 
                           for="q${index}-opt-${optIndex}"
                           style="cursor: pointer;">
                        <span class="option-letter me-2">${String.fromCharCode(65 + optIndex)}</span>
                        ${escapeHTML(typeof opt === 'string' ? opt : opt.label || opt.value)}
                    </label>
                </div>
            `).join('')}
        </div>
    `;
}

function renderShortAnswer(question, index) {
    return `
        <div class="quiz-options">
            <textarea class="form-control" 
                      id="q${index}-answer"
                      rows="4"
                      placeholder="Type your answer here..."
                      oninput="window.__appQuiz.saveAnswer(${index}, this.value)"></textarea>
        </div>
    `;
}

function renderMatching(question, index) {
    const options = question.options || [];
    const correctAnswer = question.correct_answer || {};
    const leftItems = correctAnswer.leftItems || options.left || [];
    const rightItems = correctAnswer.rightItems || options.right || [];
    
    return `
        <div class="quiz-options">
            <p class="text-muted small mb-3">
                <i class="bi bi-info-circle me-1"></i>
                Match the items on the left with the items on the right
            </p>
            <div class="row">
                ${leftItems.map((item, itemIndex) => `
                    <div class="col-12 mb-3">
                        <div class="row align-items-center">
                            <div class="col-5">
                                <div class="p-2 bg-light rounded">${escapeHTML(item)}</div>
                            </div>
                            <div class="col-2 text-center">
                                <i class="bi bi-arrow-right"></i>
                            </div>
                            <div class="col-5">
                                <select class="form-select" 
                                        id="q${index}-match-${itemIndex}"
                                        onchange="window.__appQuiz.saveMatchAnswer(${index}, ${itemIndex}, this.value)">
                                    <option value="">Select...</option>
                                    ${rightItems.map((rItem, rIndex) => `
                                        <option value="${rIndex}">${escapeHTML(rItem)}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// ==================================================
// QUIZ NAVIGATION
// ==================================================

let currentQuestionIndex = 0;

function showQuizModal(html) {
    // Remove existing modal if any
    const existingModal = document.getElementById('quiz-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', html);
    
    // Show modal
    const modalEl = document.getElementById('quiz-modal');
    const bsModal = new bootstrap.Modal(modalEl);
    
    modalEl.addEventListener('hidden.bs.modal', () => {
        modalEl.remove();
        currentQuiz = null;
        currentQuestions = [];
        currentAnswers = {};
        currentQuestionIndex = 0;
    });
    
    bsModal.show();
    
    // Initialize first question
    updateQuizProgress();
}

function nextQuestion() {
    if (!currentQuestions.length) return;
    
    if (currentQuestionIndex < currentQuestions.length - 1) {
        // Hide current question
        const currentCard = document.getElementById(`question-${currentQuestionIndex}`);
        if (currentCard) currentCard.classList.add('d-none');
        
        // Show next question
        currentQuestionIndex++;
        const nextCard = document.getElementById(`question-${currentQuestionIndex}`);
        if (nextCard) nextCard.classList.remove('d-none');
        
        // Update navigation buttons
        updateNavigationButtons();
        updateQuizProgress();
    }
}

function prevQuestion() {
    if (!currentQuestions.length) return;
    
    if (currentQuestionIndex > 0) {
        // Hide current question
        const currentCard = document.getElementById(`question-${currentQuestionIndex}`);
        if (currentCard) currentCard.classList.add('d-none');
        
        // Show previous question
        currentQuestionIndex--;
        const prevCard = document.getElementById(`question-${currentQuestionIndex}`);
        if (prevCard) prevCard.classList.remove('d-none');
        
        // Update navigation buttons
        updateNavigationButtons();
        updateQuizProgress();
    }
}

function updateNavigationButtons() {
    const prevBtn = document.getElementById('prev-question-btn');
    const nextBtn = document.getElementById('next-question-btn');
    const submitBtn = document.getElementById('submit-quiz-btn');
    
    if (prevBtn) {
        prevBtn.disabled = currentQuestionIndex === 0;
    }
    
    if (nextBtn && submitBtn) {
        if (currentQuestionIndex === currentQuestions.length - 1) {
            nextBtn.classList.add('d-none');
            submitBtn.classList.remove('d-none');
        } else {
            nextBtn.classList.remove('d-none');
            submitBtn.classList.add('d-none');
        }
    }
}

function updateQuizProgress() {
    const answeredCount = Object.keys(currentAnswers).length;
    const progressPercent = (answeredCount / currentQuestions.length) * 100;
    
    const progressBar = document.getElementById('quiz-progress-bar');
    const progressPercentEl = document.getElementById('quiz-progress-percent');
    const currentQuestionNum = document.getElementById('current-question-num');
    
    if (progressBar) progressBar.style.width = `${progressPercent}%`;
    if (progressPercentEl) progressPercentEl.textContent = `${Math.round(progressPercent)}%`;
    if (currentQuestionNum) currentQuestionNum.textContent = currentQuestionIndex + 1;
}

// ==================================================
// ANSWER SAVING
// ==================================================

function saveAnswer(questionIndex, answer) {
    currentAnswers[questionIndex] = answer;
    updateQuizProgress();
}

function saveMultiAnswer(questionIndex, optionIndex, checked) {
    if (!currentAnswers[questionIndex]) {
        currentAnswers[questionIndex] = [];
    }
    
    if (checked) {
        if (!currentAnswers[questionIndex].includes(optionIndex)) {
            currentAnswers[questionIndex].push(optionIndex);
        }
    } else {
        const idx = currentAnswers[questionIndex].indexOf(optionIndex);
        if (idx > -1) {
            currentAnswers[questionIndex].splice(idx, 1);
        }
    }
    
    updateQuizProgress();
}

function saveMatchAnswer(questionIndex, matchIndex, value) {
    if (!currentAnswers[questionIndex]) {
        currentAnswers[questionIndex] = {};
    }
    currentAnswers[questionIndex][matchIndex] = parseInt(value);
    updateQuizProgress();
}

// ==================================================
// QUIZ SUBMISSION
// ==================================================

async function submitQuiz() {
    if (!quizEnrollment || !currentQuiz) {
        notify.error('Quiz session not found');
        return;
    }
    
    // Check if all questions answered
    const unanswered = [];
    currentQuestions.forEach((q, index) => {
        if (currentAnswers[index] === undefined || currentAnswers[index] === null) {
            unanswered.push(index + 1);
        }
    });
    
    if (unanswered.length > 0) {
        const proceed = await confirmSubmission(unanswered);
        if (!proceed) return;
    }
    
    try {
        notify.info('Submitting quiz...');
        
        // Convert answers to proper format for API
        const formattedAnswers = {};
        currentQuestions.forEach((q, index) => {
            if (currentAnswers[index] !== undefined) {
                formattedAnswers[q.id] = currentAnswers[index];
            }
        });
        
        // Submit quiz
        const result = await lmsData.submitQuiz(
            quizEnrollment.id,
            currentQuiz.id,
            formattedAnswers
        );
        
        notify.close();
        
        if (result.success) {
            showQuizResult(result.attempt);
        } else {
            notify.error('Failed to submit quiz');
        }
        
    } catch (error) {
        console.error('Failed to submit quiz:', error);
        notify.error('Failed to submit quiz: ' + (error.message || 'Unknown error'));
    }
}

async function confirmSubmission(unanswered) {
    return new Promise((resolve) => {
        const modalHtml = `
            <div class="modal fade" id="confirm-submit-modal" tabindex="-1">
                <div class="modal-dialog modal-sm">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-exclamation-triangle text-warning me-2"></i>
                                Incomplete Quiz
                            </h5>
                        </div>
                        <div class="modal-body">
                            <p>You have not answered the following questions:</p>
                            <p class="fw-bold">${unanswered.join(', ')}</p>
                            <p class="text-muted mb-0">Are you sure you want to submit?</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal" onclick="window.__appQuiz._resolveConfirm(false)">Review Answers</button>
                            <button type="button" class="btn btn-warning" data-bs-dismiss="modal" onclick="window.__appQuiz._resolveConfirm(true)">Submit Anyway</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalEl = document.getElementById('confirm-submit-modal');
        const bsModal = new bootstrap.Modal(modalEl);
        
        window.__appQuiz._resolveConfirm = (value) => {
            resolve(value);
            modalEl.remove();
        };
        
        modalEl.addEventListener('hidden.bs.modal', () => {
            if (!window.__appQuiz._resolveConfirm) return;
            resolve(false);
            modalEl.remove();
        });
        
        bsModal.show();
    });
}

function showQuizResult(attempt) {
    const passed = attempt.passed;
    const score = attempt.score;
    const totalQuestions = currentQuestions.length;
    const correctCount = attempt.correct_count || Math.round((score / 100) * totalQuestions);
    
    const resultHtml = `
        <div class="modal-dialog modal-dialog-centered modal-sm">
            <div class="modal-content">
                <div class="modal-body text-center p-5">
                    ${passed ? `
                        <div class="mb-4">
                            <i class="bi bi-check-circle-fill text-success" style="font-size: 4rem;"></i>
                        </div>
                        <h3 class="text-success mb-3">Congratulations!</h3>
                        <p class="mb-4">You passed the quiz</p>
                    ` : `
                        <div class="mb-4">
                            <i class="bi bi-x-circle-fill text-danger" style="font-size: 4rem;"></i>
                        </div>
                        <h3 class="text-danger mb-3">Not Quite</h3>
                        <p class="mb-4">You need 70% to pass</p>
                    `}
                    
                    <div class="card mb-4">
                        <div class="card-body">
                            <div class="row">
                                <div class="col-4">
                                    <h4 class="mb-0">${score.toFixed(0)}%</h4>
                                    <small class="text-muted">Score</small>
                                </div>
                                <div class="col-4">
                                    <h4 class="mb-0">${correctCount}/${totalQuestions}</h4>
                                    <small class="text-muted">Correct</small>
                                </div>
                                <div class="col-4">
                                    <h4 class="mb-0">${attempt.attempt_number || 1}</h4>
                                    <small class="text-muted">Attempt</small>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    ${passed ? `
                        <button type="button" class="btn btn-success w-100" onclick="window.__appQuiz.closeQuizAndContinue()">
                            <i class="bi bi-check-circle me-1"></i> Continue
                        </button>
                    ` : `
                        <div class="d-grid gap-2">
                            <button type="button" class="btn btn-primary" onclick="window.__appQuiz.retryQuiz()">
                                <i class="bi bi-arrow-clockwise me-1"></i> Try Again
                            </button>
                            <button type="button" class="btn btn-outline-secondary" onclick="window.__appQuiz.closeQuizAndContinue()">
                                Continue Later
                            </button>
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
    
    // Replace modal content
    const modalEl = document.getElementById('quiz-modal');
    const modalBody = modalEl.querySelector('.modal-dialog');
    modalBody.outerHTML = resultHtml;
}

async function retryQuiz() {
    // Close current modal
    const modalEl = document.getElementById('quiz-modal');
    if (modalEl) {
        const bsModal = bootstrap.Modal.getInstance(modalEl);
        if (bsModal) bsModal.hide();
    }
    
    // Restart quiz
    await startQuiz(currentQuiz.id, quizEnrollment);
}

function closeQuizAndContinue() {
    // Close modal
    const modalEl = document.getElementById('quiz-modal');
    if (modalEl) {
        const bsModal = bootstrap.Modal.getInstance(modalEl);
        if (bsModal) bsModal.hide();
    }
    
    // Emit event to refresh progress
    emit('lms:progressUpdated');
}

// ==================================================
// GET QUIZ ATTEMPTS
// ==================================================

async function getQuizAttempts(lessonId, enrollmentId) {
    try {
        const result = await lmsData.getQuizAttempt(null); // This should be fixed in API
        return result.attempts || [];
    } catch (error) {
        console.error('Failed to get quiz attempts:', error);
        return [];
    }
}

// ==================================================
// EXPORTS
// ==================================================

export {
    startQuiz,
    nextQuestion,
    prevQuestion,
    saveAnswer,
    saveMultiAnswer,
    saveMatchAnswer,
    submitQuiz,
    retryQuiz,
    closeQuizAndContinue,
    getQuizAttempts
};

// Window exports for onclick handlers
window.__appQuiz = {
    nextQuestion,
    prevQuestion,
    saveAnswer,
    saveMultiAnswer,
    saveMatchAnswer,
    submitQuiz,
    retryQuiz,
    closeQuizAndContinue,
    _resolveConfirm: null
};