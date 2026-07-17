<?php

namespace App\Controllers;

use App\Models\News;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class NewsController
{
    public function index(Request $request)
    {
        $articles = News::query()
            ->with('author:id,username')
            ->where('status', 'published')
            ->when(
                $request->filled('category'),
                fn ($query) => $query->where('category', $request->string('category')),
            )
            ->latest('published_at')
            ->paginate(min($request->integer('limit', 9), 30));

        return response()->json($articles);
    }

    public function show(News $news)
    {
        abort_unless($news->status === 'published', 404);

        return response()->json(['article' => $news->load('author:id,username')]);
    }

    public function adminIndex()
    {
        return response()->json([
            'articles' => News::with('author:id,username')->latest()->get(),
        ]);
    }

    public function store(Request $request)
    {
        $payload = $this->validateArticle($request);
        $payload['author_id'] = $request->user()->id;
        $payload['slug'] = $this->uniqueSlug($payload['title']);
        $payload['published_at'] = $payload['status'] === 'published' ? now() : null;
        $article = News::create($payload);

        return response()->json(['article' => $article], 201);
    }

    public function update(Request $request, News $news)
    {
        $payload = $this->validateArticle($request, true);

        if (isset($payload['title']) && $payload['title'] !== $news->title) {
            $payload['slug'] = $this->uniqueSlug($payload['title']);
        }

        if (($payload['status'] ?? null) === 'published' && ! $news->published_at) {
            $payload['published_at'] = now();
        }

        $news->update($payload);

        return response()->json(['article' => $news->fresh()]);
    }

    public function destroy(News $news)
    {
        $news->delete();

        return response()->json(['message' => 'Article deleted.']);
    }

    public function generateDraft(Request $request)
    {
        $payload = $request->validate([
            'topic' => ['required', 'string', 'min:3', 'max:100'],
            'category' => ['required', 'string', 'max:40'],
        ]);

        $topic = trim($payload['topic']);

        return response()->json([
            'draft' => [
                'title' => Str::title($topic).': what riders need to know',
                'excerpt' => "A practical CycleLine briefing on {$topic}, with the details that matter before your next ride.",
                'body' => "Why it matters\n\n{$topic} is changing how local riders plan, prepare, and move. Start with the conditions, check your equipment, and choose a route that fits your current fitness—not the ride you wish you had trained for.\n\nWhat to do next\n\nReview the latest local guidance, save a route in CycleLine, and share your plan with someone before you leave. Small preparation choices make the biggest difference once the road tilts upward.",
                'category' => $payload['category'],
                'status' => 'draft',
            ],
        ]);
    }

    private function validateArticle(Request $request, bool $partial = false): array
    {
        $prefix = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'title' => [$prefix, 'string', 'min:5', 'max:160'],
            'excerpt' => [$prefix, 'string', 'min:20', 'max:320'],
            'body' => [$prefix, 'string', 'min:80', 'max:20000'],
            'category' => [$prefix, 'string', 'max:40'],
            'image_url' => [
                'nullable',
                'string',
                'max:500',
                function (string $attribute, mixed $value, Closure $fail) {
                    if (! str_starts_with($value, '/') && filter_var($value, FILTER_VALIDATE_URL) === false) {
                        $fail('The cover image must be a site path or a valid URL.');
                    }
                },
            ],
            'status' => [$prefix, Rule::in(['draft', 'published'])],
        ]);
    }

    private function uniqueSlug(string $title): string
    {
        return Str::slug($title).'-'.Str::lower(Str::random(5));
    }
}
