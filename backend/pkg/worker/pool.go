package worker

import (
	"context"
	"sync"
	"sync/atomic"
)

// Task 表示一个异步任务
type Task func()

// Pool Worker Pool，用于限制并发 Goroutine 数量
type Pool struct {
	wg       sync.WaitGroup
	workers  chan struct{}
	tasks    chan Task
	quit     chan struct{}
	stopOnce sync.Once

	// 统计信���
	activeWorkers atomic.Int32
	totalTasks    atomic.Int64
	completedTasks atomic.Int64
}

// NewPool 创建一个新的 Worker Pool
// workerSize: 最大并发 worker 数量
// taskQueueSize: 任务队列大小（0 表示无限制）
func NewPool(workerSize int, taskQueueSize int) *Pool {
	if workerSize <= 0 {
		workerSize = 100 // 默认 100 个 worker
	}

	p := &Pool{
		workers: make(chan struct{}, workerSize),
		tasks:   make(chan Task, taskQueueSize),
		quit:    make(chan struct{}),
	}

	// 启动指定数量的 worker
	for i := 0; i < workerSize; i++ {
		p.wg.Add(1)
		go p.worker()
	}

	return p
}

// worker 处理任务的协程
func (p *Pool) worker() {
	defer p.wg.Done()

	for {
		select {
		case task, ok := <-p.tasks:
			if !ok {
				return
			}
			p.activeWorkers.Add(1)
			task()
			p.activeWorkers.Add(-1)
			p.completedTasks.Add(1)
		case <-p.quit:
			return
		}
	}
}

// Submit 提交任务到 Worker Pool
// 如果队列已满且配置了有限队列，会返回 false
func (p *Pool) Submit(task Task) bool {
	p.totalTasks.Add(1)

	select {
	case p.tasks <- task:
		return true
	default:
		// 队列已满
		p.totalTasks.Add(-1)
		return false
	}
}

// SubmitBlocking 阻塞式提交任务（直到队列有空间）
func (p *Pool) SubmitBlocking(task Task) {
	p.totalTasks.Add(1)
	p.tasks <- task
}

// SubmitWithContext 支持上下文的任务提交
func (p *Pool) SubmitWithContext(ctx context.Context, task Task) error {
	p.totalTasks.Add(1)

	select {
	case p.tasks <- task:
		return nil
	case <-ctx.Done():
		p.totalTasks.Add(-1)
		return ctx.Err()
	}
}

// Stop 优雅关闭 Worker Pool
func (p *Pool) Stop(wait bool) {
	p.stopOnce.Do(func() {
		close(p.quit)

		if wait {
			p.wg.Wait()
		}
	})
}

// Stats 返回 Pool 统计信息
type Stats struct {
	ActiveWorkers   int32
	TotalTasks      int64
	CompletedTasks  int64
	PendingTasks    int
	WorkerCapacity  int
}

// Stats 获取统计信息
func (p *Pool) Stats() Stats {
	return Stats{
		ActiveWorkers:  p.activeWorkers.Load(),
		TotalTasks:     p.totalTasks.Load(),
		CompletedTasks: p.completedTasks.Load(),
		PendingTasks:   len(p.tasks),
		WorkerCapacity: cap(p.workers),
	}
}
