document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const screens = {
        welcome: document.getElementById('welcome-screen'),
        exam: document.getElementById('exam-screen'),
        results: document.getElementById('results-screen')
    };
    
    // Buttons
    const startBtn = document.getElementById('start-btn');
    const nextBtn = document.getElementById('next-btn');
    const restartBtn = document.getElementById('restart-btn');
    
    // Info Elements
    const totalQuestionsInfo = document.getElementById('total-questions-info');
    const totalTimeInfo = document.getElementById('total-time-info');
    
    // Exam Elements
    const questionCounter = document.getElementById('question-counter');
    const progressBar = document.getElementById('progress-bar');
    const timerDisplay = document.getElementById('timer');
    const timerContainer = document.querySelector('.timer-container');
    const questionText = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    
    // Results Elements
    const resultTitle = document.getElementById('result-title');
    const scoreCircle = document.querySelector('.score-circle');
    const scoreText = document.getElementById('score-text');
    const resultMessage = document.getElementById('result-message');
    const reviewContainer = document.getElementById('review-container');

    // Study Mode Elements
    const studyModeToggle = document.getElementById('study-mode-toggle');
    const feedbackModal = document.getElementById('feedback-modal');
    const feedbackTitle = document.getElementById('feedback-title');
    const feedbackCorrectAnswer = document.getElementById('feedback-correct-answer');
    const feedbackExplanation = document.getElementById('feedback-explanation');
    const feedbackNextBtn = document.getElementById('feedback-next-btn');

    // State
    let questions = [];
    let currentQuestionIndex = 0;
    let selectedOptionIndex = null;
    let userAnswers = []; // Store the user's selected index for each question
    
    // Config (Simulator parameters based on COSEVI 2026)
    const PASS_PERCENTAGE = 80;
    const TIME_PER_QUESTION_SEC = 75; // 50 mins / 40 questions = 75 secs per question.
    let totalExamTime = 0;
    let timeRemaining = 0;
    let timerInterval = null;

    // Fetch questions from JSON
    async function loadQuestions() {
        try {
            const response = await fetch('questions.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            questions = await response.json();
            
            // Organize questions by chapter
            const questionsByChapter = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
            
            questions.forEach(q => {
                const ch = q.chapter || 1; // Default to 1 if missing
                if (questionsByChapter[ch]) {
                    questionsByChapter[ch].push(q);
                }
            });
            
            // Shuffle each chapter's questions
            Object.values(questionsByChapter).forEach(chapArray => {
                for (let i = chapArray.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [chapArray[i], chapArray[j]] = [chapArray[j], chapArray[i]];
                }
            });
            
            // Select required amounts: 10 for chap 2, 6 for the rest
            let selectedQuestions = [];
            const requirements = { 1: 6, 2: 10, 3: 6, 4: 6, 5: 6, 6: 6 };
            
            for (const [ch, amount] of Object.entries(requirements)) {
                const chapArray = questionsByChapter[ch];
                selectedQuestions.push(...chapArray.slice(0, Math.min(amount, chapArray.length)));
            }
            
            // If we somehow didn't reach 40 (e.g. missing questions in a chapter), fill with random remaining
            if (selectedQuestions.length < 40) {
                let remaining = questions.filter(q => !selectedQuestions.includes(q));
                for (let i = remaining.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
                }
                const needed = 40 - selectedQuestions.length;
                selectedQuestions.push(...remaining.slice(0, needed));
            }
            
            // Final shuffle so chapters are mixed during the exam
            for (let i = selectedQuestions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [selectedQuestions[i], selectedQuestions[j]] = [selectedQuestions[j], selectedQuestions[i]];
            }
            
            questions = selectedQuestions;
            
            // Update total time based on the number of questions to show
            totalExamTime = questions.length * TIME_PER_QUESTION_SEC;
            
            // Update UI info
            totalQuestionsInfo.textContent = questions.length;
            const minutes = Math.floor(totalExamTime / 60);
            totalTimeInfo.textContent = `${minutes}:00`;
            
            startBtn.disabled = false;
            
        } catch (error) {
            console.error("Could not load questions:", error);
            questionText.textContent = "Error al cargar las preguntas. Verifica que questions.json existe.";
            startBtn.disabled = true;
            startBtn.textContent = "Error al cargar";
        }
    }

    // Navigation
    function showScreen(screenName) {
        Object.values(screens).forEach(screen => {
            screen.classList.remove('active');
            setTimeout(() => {
                if(!screen.classList.contains('active')) {
                    screen.style.display = 'none';
                }
            }, 500); // Wait for transition
        });
        
        setTimeout(() => {
            screens[screenName].style.display = 'flex';
            // Trigger reflow
            void screens[screenName].offsetWidth;
            screens[screenName].classList.add('active');
        }, 50);
    }

    // Exam Logic
    function startExam() {
        currentQuestionIndex = 0;
        userAnswers = new Array(questions.length).fill(null);
        timeRemaining = totalExamTime;
        
        // Reset timer UI
        timerContainer.classList.remove('timer-warning');
        
        showScreen('exam');
        loadQuestion(currentQuestionIndex);
        startTimer();
    }

    function loadQuestion(index) {
        const question = questions[index];
        selectedOptionIndex = null;
        nextBtn.disabled = true;
        
        // Update header
        questionCounter.textContent = `Pregunta ${index + 1} / ${questions.length}`;
        const progressPercent = ((index) / questions.length) * 100;
        progressBar.style.width = `${progressPercent}%`;
        
        // Render question
        questionText.textContent = question.question;
        
        // Render options
        optionsContainer.innerHTML = '';
        const letters = ['A', 'B', 'C', 'D'];
        
        question.options.forEach((optionText, i) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerHTML = `
                <span class="option-letter">${letters[i] || '-'})</span>
                <span class="option-text">${optionText}</span>
            `;
            
            btn.addEventListener('click', () => {
                // Deselect all
                document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
                // Select current
                btn.classList.add('selected');
                selectedOptionIndex = i;
                nextBtn.disabled = false;
            });
            
            optionsContainer.appendChild(btn);
        });
    }

    function handleNext() {
        if (selectedOptionIndex !== null) {
            userAnswers[currentQuestionIndex] = selectedOptionIndex;
        }
        
        const question = questions[currentQuestionIndex];
        const isCorrect = selectedOptionIndex === question.correct_index;

        if (studyModeToggle.checked) {
            pauseTimer();
            
            // Populate feedback modal
            if (isCorrect) {
                feedbackTitle.textContent = "¡Respuesta Correcta!";
                feedbackTitle.style.color = "var(--accent-green)";
            } else {
                feedbackTitle.textContent = "Respuesta Incorrecta";
                feedbackTitle.style.color = "var(--accent-red)";
            }
            
            feedbackCorrectAnswer.textContent = question.options[question.correct_index];
            feedbackExplanation.textContent = question.explanation || "No hay explicación detallada para esta pregunta.";
            
            // Show modal
            feedbackModal.classList.add('active');
        } else {
            proceedToNextQuestion();
        }
    }

    function proceedToNextQuestion() {
        currentQuestionIndex++;
        
        if (currentQuestionIndex < questions.length) {
            // Animate transition slightly
            optionsContainer.style.opacity = 0;
            questionText.style.opacity = 0;
            
            setTimeout(() => {
                loadQuestion(currentQuestionIndex);
                optionsContainer.style.opacity = 1;
                questionText.style.opacity = 1;
            }, 200);
            
        } else {
            finishExam();
        }
    }

    // Timer Logic
    function startTimer() {
        updateTimerDisplay();
        resumeTimer();
    }
    
    function pauseTimer() {
        clearInterval(timerInterval);
    }
    
    function resumeTimer() {
        clearInterval(timerInterval); // Prevent multiple intervals
        timerInterval = setInterval(() => {
            timeRemaining--;
            updateTimerDisplay();
            
            if (timeRemaining <= 60) {
                timerContainer.classList.add('timer-warning');
            }
            
            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                finishExam(true); // true = timeout
            }
        }, 1000);
    }

    function updateTimerDisplay() {
        const m = Math.floor(timeRemaining / 60);
        const s = timeRemaining % 60;
        timerDisplay.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    // Results Logic
    function finishExam(isTimeout = false) {
        clearInterval(timerInterval);
        
        // Calculate score
        let correctAnswers = 0;
        userAnswers.forEach((answer, index) => {
            if (answer === questions[index].correct_index) {
                correctAnswers++;
            }
        });
        
        const percentage = Math.round((correctAnswers / questions.length) * 100);
        const passed = percentage >= PASS_PERCENTAGE;
        
        // Update UI
        progressBar.style.width = '100%';
        
        setTimeout(() => {
            showScreen('results');
            renderResults(percentage, passed, isTimeout, correctAnswers);
        }, 500);
    }

    function renderResults(percentage, passed, isTimeout, correctAnswers) {
        // Score Circle
        scoreText.textContent = `${percentage}%`;
        scoreCircle.className = 'score-circle'; // reset
        scoreCircle.classList.add(passed ? 'pass' : 'fail');
        
        // Title & Message
        if (isTimeout) {
            resultTitle.textContent = "Tiempo Agotado";
        } else {
            resultTitle.textContent = passed ? "¡Examen Aprobado!" : "Examen Reprobado";
        }
        
        resultMessage.textContent = `Has acertado ${correctAnswers} de ${questions.length} preguntas. ${passed ? '¡Felicidades, estás listo para la prueba práctica!' : `Necesitas al menos ${PASS_PERCENTAGE}% para aprobar. ¡Sigue practicando!`}`;
        
        // Render Review
        reviewContainer.innerHTML = '';
        const letters = ['A', 'B', 'C', 'D'];
        
        questions.forEach((q, i) => {
            const userAnswerIdx = userAnswers[i];
            const isCorrect = userAnswerIdx === q.correct_index;
            
            const reviewDiv = document.createElement('div');
            reviewDiv.className = `review-item ${isCorrect ? 'correct' : 'incorrect'}`;
            
            let html = `<div class="review-question">${i + 1}. ${q.question}</div>`;
            
            if (userAnswerIdx !== null) {
                html += `
                    <div class="review-answer your-answer ${isCorrect ? '' : 'wrong'}">
                        <span class="label">Tu respuesta:</span>
                        <span>${letters[userAnswerIdx]}) ${q.options[userAnswerIdx]}</span>
                    </div>
                `;
            } else {
                html += `
                    <div class="review-answer your-answer wrong">
                        <span class="label">Tu respuesta:</span>
                        <span>No contestada</span>
                    </div>
                `;
            }
            
            if (!isCorrect) {
                html += `
                    <div class="review-answer correct-answer">
                        <span class="label">Correcta:</span>
                        <span>${letters[q.correct_index]}) ${q.options[q.correct_index]}</span>
                    </div>
                `;
            }
            
            html += `
                <div class="review-explanation">
                    ${q.explanation}
                </div>
            `;
            
            reviewDiv.innerHTML = html;
            reviewContainer.appendChild(reviewDiv);
        });
    }

    // Event Listeners
    startBtn.addEventListener('click', function() {
        this.blur(); // Remove focus
        startExam();
    });
    
    nextBtn.addEventListener('click', function() {
        this.blur(); // Remove focus
        handleNext();
    });
    
    restartBtn.addEventListener('click', function() {
        this.blur(); // Remove focus
        showScreen('welcome');
    });
    
    feedbackNextBtn.addEventListener('click', function() {
        this.blur(); // Remove focus
        feedbackModal.classList.remove('active');
        resumeTimer();
        setTimeout(() => {
            proceedToNextQuestion();
        }, 300); // wait for modal fade out
    });

    // Init
    loadQuestions();
});
