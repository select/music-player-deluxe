<template>
	<div class="container mx-auto px-4 py-8 max-w-6xl">
		<div class="flex items-center justify-between mb-8">
			<h1 class="text-3xl font-bold flex items-center gap-3">
				<div class="i-mdi-chart-bar" />
				Statistics
			</h1>
			<AppBtn icon="i-mdi-arrow-left" variant="primary" to="/">
				Back to Playlists
			</AppBtn>
		</div>

		<!-- Loading State -->
		<div v-if="loading" class="flex items-center justify-center py-12">
			<div class="flex items-center gap-3 text-primary-3">
				<div class="i-mdi-loading animate-spin text-2xl" />
				<span>Loading statistics...</span>
			</div>
		</div>

		<!-- Error State -->
		<div
			v-else-if="error"
			class="bg-primary-1 border border-error rounded-lg p-6"
		>
			<div class="flex items-center gap-2 text-error">
				<div class="i-mdi-alert-circle" />
				<strong>Error:</strong> {{ error }}
			</div>
		</div>

		<!-- Stats Content -->
		<div v-else class="space-y-8">
			<!-- Data Sources Section -->
			<section class="bg-bg-gradient rounded-lg p-6">
				<h2 class="text-2xl font-semibold mb-6 flex items-center gap-2">
					<div class="i-mdi-database" />
					Data Sources
				</h2>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
					<div
						v-for="(source, key) in statsData.sources"
						:key="key"
						class="bg-primary-1 rounded-lg p-4 hover:bg-primary-2 transition-colors"
					>
						<div class="flex items-start justify-between mb-2">
							<h3 class="text-lg font-semibold text-primary-4">
								{{ source.name }}
							</h3>
							<a
								:href="source.url"
								target="_blank"
								rel="noopener noreferrer"
								class="text-accent hover:text-accent-1 transition-colors"
							>
								<div class="i-mdi-open-in-new text-xl" />
							</a>
						</div>
						<p class="text-sm text-primary-3 mb-4">
							{{ source.summary }}
						</p>
						<div class="flex gap-4 text-sm">
							<div v-if="source.items" class="flex items-center gap-1">
								<div class="i-mdi-file-music text-accent" />
								<span class="text-primary-3">{{ source.items }} items</span>
							</div>
							<div v-if="source.tags" class="flex items-center gap-1">
								<div class="i-mdi-tag text-accent" />
								<span class="text-primary-3">{{ source.tags }} tags</span>
							</div>
						</div>
					</div>
				</div>

				<!-- Bar Chart for Sources -->
				<div class="mt-6">
					<h3 class="text-lg font-semibold mb-4">Items per Source</h3>
					<div class="space-y-3">
						<div
							v-for="(source, key) in sortedSources"
							:key="key"
							class="flex items-center gap-3"
						>
							<div class="w-32 text-sm text-primary-3 truncate">
								{{ source.name }}
							</div>
							<div
								class="flex-1 relative h-8 bg-primary-1 rounded-lg overflow-hidden"
							>
								<div
									class="absolute inset-y-0 left-0 bg-accent transition-all duration-500 flex items-center justify-end pr-2"
									:style="{
										width: getBarWidth(source.items || 0, maxSourceItems),
									}"
								>
									<span class="text-xs font-semibold text-primary-1">
										{{ source.items }}
									</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			<!-- Repository Statistics Section -->
			<section v-if="statsData.repository" class="bg-bg-gradient rounded-lg p-6">
				<h2 class="text-2xl font-semibold mb-6 flex items-center gap-2">
					<div class="i-mdi-code-braces" />
					Repository Statistics
				</h2>

				<!-- Project Overview -->
				<div class="mb-8">
					<h3 class="text-lg font-semibold mb-4">Project Overview</h3>
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
						<div class="bg-primary-1 rounded-lg p-4 text-center">
							<div class="text-sm text-primary-3 mb-1">Project Name</div>
							<div class="text-lg font-semibold text-primary-4">
								{{ statsData.repository.project.name }}
							</div>
						</div>
						<div class="bg-primary-1 rounded-lg p-4 text-center">
							<div class="text-sm text-primary-3 mb-1">Dependencies</div>
							<div class="text-lg font-semibold text-primary-4">
								{{ statsData.repository.project.dependencies }}
							</div>
						</div>
						<div class="bg-primary-1 rounded-lg p-4 text-center">
							<div class="text-sm text-primary-3 mb-1">Dev Dependencies</div>
							<div class="text-lg font-semibold text-primary-4">
								{{ statsData.repository.project.devDependencies }}
							</div>
						</div>
						<div class="bg-primary-1 rounded-lg p-4 text-center">
							<div class="text-sm text-primary-3 mb-1">Type</div>
							<div class="text-lg font-semibold text-primary-4">
								{{ statsData.repository.project.type }}
							</div>
						</div>
					</div>
				</div>

				<!-- File Statistics -->
				<div class="mb-8">
					<h3 class="text-lg font-semibold mb-4">File Statistics</h3>
					<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
						<div class="bg-primary-1 rounded-lg p-4 text-center">
							<div class="text-2xl font-bold text-accent mb-1">
								{{ statsData.repository.files.totalFiles }}
							</div>
							<div class="text-sm text-primary-3">Total Files</div>
						</div>
						<div class="bg-primary-1 rounded-lg p-4 text-center">
							<div class="text-2xl font-bold text-accent mb-1">
								{{ formatNumber(statsData.repository.files.totalLines) }}
							</div>
							<div class="text-sm text-primary-3">Total Lines</div>
						</div>
						<div class="bg-primary-1 rounded-lg p-4 text-center">
							<div class="text-2xl font-bold text-accent mb-1">
								{{ formatFileSize(statsData.repository.files.totalSize) }}
							</div>
							<div class="text-sm text-primary-3">Total Size</div>
						</div>
					</div>

					<!-- File Types Bar Chart -->
					<div>
						<h4 class="font-semibold mb-3 text-primary-4">Top File Types</h4>
						<div class="space-y-2">
							<div
								v-for="ext in topFileTypes"
								:key="ext.ext"
								class="flex items-center gap-3"
							>
								<div class="w-16 text-xs text-primary-3 truncate">
									{{ ext.ext }}
								</div>
								<div
									class="flex-1 relative h-6 bg-primary-1 rounded-lg overflow-hidden"
								>
									<div
										class="absolute inset-y-0 left-0 bg-gradient-to-r from-accent to-accent-1 transition-all duration-500 flex items-center justify-end pr-2"
										:style="{ width: getBarWidth(ext.count, maxFileCount) }"
									>
										<span class="text-xs font-semibold text-primary-1">
											{{ ext.count }} files
										</span>
									</div>
								</div>
								<div class="w-20 text-right text-xs text-primary-3">
									{{ ((ext.count / statsData.repository.files.totalFiles) * 100).toFixed(1) }}%
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Vue Components Breakdown -->
				<div class="mb-8">
					<h3 class="text-lg font-semibold mb-4">Vue Components</h3>
					<div class="grid grid-cols-2 md:grid-cols-5 gap-3">
						<div class="bg-primary-1 rounded-lg p-3 text-center">
							<div class="text-xl font-bold text-accent">
								{{ statsData.repository.components.total }}
							</div>
							<div class="text-xs text-primary-3 mt-1">Total</div>
						</div>
						<div class="bg-primary-1 rounded-lg p-3 text-center">
							<div class="text-xl font-bold text-accent-1">
								{{ statsData.repository.components.admin }}
							</div>
							<div class="text-xs text-primary-3 mt-1">Admin</div>
						</div>
						<div class="bg-primary-1 rounded-lg p-3 text-center">
							<div class="text-xl font-bold text-accent-1">
								{{ statsData.repository.components.app }}
							</div>
							<div class="text-xs text-primary-3 mt-1">App</div>
						</div>
						<div class="bg-primary-1 rounded-lg p-3 text-center">
							<div class="text-xl font-bold text-accent-1">
								{{ statsData.repository.components.pages }}
							</div>
							<div class="text-xs text-primary-3 mt-1">Pages</div>
						</div>
						<div class="bg-primary-1 rounded-lg p-3 text-center">
							<div class="text-xl font-bold text-accent-1">
								{{ statsData.repository.components.layouts }}
							</div>
							<div class="text-xs text-primary-3 mt-1">Layouts</div>
						</div>
					</div>

					<!-- Component Breakdown Bar Chart -->
					<div class="mt-4">
						<div class="space-y-2">
							<div
								v-for="component in componentBreakdown"
								:key="component.name"
								class="flex items-center gap-3"
							>
								<div class="w-24 text-sm text-primary-3">{{ component.name }}</div>
								<div
									class="flex-1 relative h-6 bg-primary-1 rounded-lg overflow-hidden"
								>
									<div
										class="absolute inset-y-0 left-0 bg-accent-1 transition-all duration-500 flex items-center justify-end pr-2"
										:style="{ width: getBarWidth(component.count, statsData.repository.components.total) }"
									>
										<span class="text-xs font-semibold text-primary-1">
											{{ component.count }}
										</span>
									</div>
								</div>
								<div class="w-16 text-right text-sm text-primary-3">
									{{ ((component.count / statsData.repository.components.total) * 100).toFixed(1) }}%
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- API Endpoints -->
				<div>
					<h3 class="text-lg font-semibold mb-4">API Endpoints</h3>
					<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
						<div class="bg-primary-1 rounded-lg p-3 text-center">
							<div class="text-xl font-bold text-accent">
								{{ statsData.repository.api.total }}
							</div>
							<div class="text-xs text-primary-3 mt-1">Total</div>
						</div>
						<div class="bg-primary-1 rounded-lg p-3 text-center">
							<div class="text-xl font-bold text-accent-2">
								{{ statsData.repository.api.playlists }}
							</div>
							<div class="text-xs text-primary-3 mt-1">Playlists</div>
						</div>
						<div class="bg-primary-1 rounded-lg p-3 text-center">
							<div class="text-xl font-bold text-accent-2">
								{{ statsData.repository.api.musicbrainz }}
							</div>
							<div class="text-xs text-primary-3 mt-1">MusicBrainz</div>
						</div>
						<div class="bg-primary-1 rounded-lg p-3 text-center">
							<div class="text-xl font-bold text-accent-2">
								{{ statsData.repository.api.songs }}
							</div>
							<div class="text-xs text-primary-3 mt-1">Songs</div>
						</div>
					</div>

					<!-- API Breakdown Bar Chart -->
					<div class="space-y-2">
						<div
							v-for="endpoint in apiBreakdown"
							:key="endpoint.name"
							class="flex items-center gap-3"
						>
							<div class="w-24 text-sm text-primary-3">{{ endpoint.name }}</div>
							<div
								class="flex-1 relative h-6 bg-primary-1 rounded-lg overflow-hidden"
							>
								<div
									class="absolute inset-y-0 left-0 bg-accent-2 transition-all duration-500 flex items-center justify-end pr-2"
									:style="{ width: getBarWidth(endpoint.count, statsData.repository.api.total) }"
								>
									<span class="text-xs font-semibold text-primary-1">
										{{ endpoint.count }}
									</span>
								</div>
							</div>
							<div class="w-16 text-right text-sm text-primary-3">
								{{ ((endpoint.count / statsData.repository.api.total) * 100).toFixed(1) }}%
							</div>
						</div>
					</div>
				</div>
			</section>

			<!-- Playlist Section -->
			<section class="bg-bg-gradient rounded-lg p-6">
				<h2 class="text-2xl font-semibold mb-6 flex items-center gap-2">
					<div class="i-mdi-playlist-music" />
					Playlist Overview
				</h2>

				<!-- Playlist Summary Stats -->
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
					<div class="bg-primary-1 rounded-lg p-4 text-center">
						<div class="text-3xl font-bold text-accent mb-1">
							{{ statsData.playlist.items }}
						</div>
						<div class="text-sm text-primary-3">Total Songs</div>
					</div>
					<div class="bg-primary-1 rounded-lg p-4">
						<div class="text-sm font-medium text-primary-3 mb-3 text-center">
							Tags Coverage
						</div>
						<div class="flex items-center justify-between">
							<div class="text-center flex-1">
								<div class="text-2xl font-bold text-accent mb-1">
									{{ statsData.playlist.itemsWithTags }}
								</div>
								<div class="text-xs text-primary-3">Songs</div>
							</div>
							<div class="text-center flex-1">
								<div class="text-2xl font-bold text-accent mb-1">
									{{ playlistTagsPercentage }}%
								</div>
								<div class="text-xs text-primary-3">Coverage</div>
							</div>
						</div>
					</div>
					<div class="bg-primary-1 rounded-lg p-4">
						<div class="text-sm font-medium text-primary-3 mb-3 text-center">
							External IDs Coverage
						</div>
						<div class="flex items-center justify-between">
							<div class="text-center flex-1">
								<div class="text-2xl font-bold text-accent mb-1">
									{{ statsData.playlist.itemsWithExternalIds }}
								</div>
								<div class="text-xs text-primary-3">Songs</div>
							</div>
							<div class="text-center flex-1">
								<div class="text-2xl font-bold text-accent mb-1">
									{{ playlistExternalIdsPercentage }}%
								</div>
								<div class="text-xs text-primary-3">Coverage</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Playlist External Links with Percentages -->
				<div>
					<h3 class="text-lg font-semibold mb-4">Platform Coverage</h3>
					<p class="text-sm text-primary-3 mb-4">
						Percentage of playlist songs available on each platform
					</p>
					<div class="space-y-2">
						<div
							v-for="platform in sortedPlaylistPlatforms"
							:key="platform.key"
							class="flex items-center gap-3"
						>
							<div class="w-40 text-sm text-primary-3 truncate">
								{{ formatPlatformName(platform.key) }}
							</div>
							<div
								class="flex-1 relative h-7 bg-primary-1 rounded-lg overflow-hidden"
							>
								<div
									class="absolute inset-y-0 left-0 transition-all duration-500 flex items-center justify-end pr-2"
									:class="
										getTagBarColor(platform.count, statsData.playlist.items)
									"
									:style="{
										width: getBarWidth(
											platform.count,
											statsData.playlist.items,
										),
									}"
								>
									<span class="text-xs font-semibold text-primary-1">
										{{ platform.count }}
									</span>
								</div>
							</div>
							<div class="w-20 text-right text-sm text-primary-3">
								{{ getPercentage(platform.count, statsData.playlist.items) }}%
							</div>
						</div>
					</div>
				</div>
			</section>

			<!-- Tag Statistics Section -->
			<section class="bg-bg-gradient rounded-lg p-6">
				<h2 class="text-2xl font-semibold mb-6 flex items-center gap-2">
					<div class="i-mdi-tag-multiple" />
					Tag Statistics
				</h2>

				<!-- Top 50 Tags -->
				<div class="mb-8">
					<h3 class="text-lg font-semibold mb-4">Top 50 Tags</h3>
					<div class="space-y-2">
						<div
							v-for="tag in statsData.playlist.topTags"
							:key="tag.tag"
							class="flex items-center gap-3"
						>
							<div class="w-32 text-sm text-primary-3 truncate">
								{{ tag.tag }}
							</div>
							<div
								class="flex-1 relative h-7 bg-primary-1 rounded-lg overflow-hidden"
							>
								<div
									class="absolute inset-y-0 left-0 transition-all duration-500 flex items-center justify-end pr-2"
									:class="getTagBarColor(tag.count, maxTagCount)"
									:style="{ width: getBarWidth(tag.count, maxTagCount) }"
								>
									<span class="text-xs font-semibold text-primary-1">
										{{ tag.count }}
									</span>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Top Tags by User -->
				<div>
					<h3 class="text-lg font-semibold mb-4">Top Tags by User</h3>
					<div class="space-y-6">
						<div
							v-for="userId in sortedUsers"
							:key="userId"
							class="bg-primary-1 rounded-lg p-4"
						>
							<div
								class="font-medium text-primary-4 mb-3 flex items-center justify-between"
							>
								<div class="flex items-center gap-3">
									<div
										class="w-10 h-10 rounded-full flex items-center justify-center"
										:style="{ backgroundColor: getUserColor(userId) }"
									>
										<div class="i-mdi-account text-2xl text-primary-1" />
									</div>
									<span class="text-sm text-primary-3">
										{{ statsData.playlist.topTagsByUser[userId]!.totalSongs }}
										songs
									</span>
								</div>
							</div>
							<div class="space-y-2">
								<div
									v-for="tag in statsData.playlist.topTagsByUser[userId]!.tags"
									:key="tag.tag"
									class="flex items-center gap-3"
								>
									<div class="w-24 text-sm text-primary-3 truncate">
										{{ tag.tag }}
									</div>
									<div class="flex-1 relative h-6 rounded-lg overflow-hidden">
										<div
											class="absolute inset-y-0 left-0 transition-all duration-500 flex items-center justify-end pr-2"
											:class="
												getTagBarColor(
													tag.count,
													statsData.playlist.topTagsByUser[userId]!.tags[0]!
														.count,
												)
											"
											:style="{
												width: getBarWidth(
													tag.count,
													statsData.playlist.topTagsByUser[userId]!.tags[0]!
														.count,
												),
											}"
										>
											<span class="text-xs font-semibold text-primary-1">
												{{ tag.count }}
											</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			<!-- Country Statistics Section -->
			<section class="bg-bg-gradient rounded-lg p-6">
				<h2 class="text-2xl font-semibold mb-6 flex items-center gap-2">
					<div class="i-mdi-earth" />
					Country Statistics
				</h2>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
					<div class="bg-primary-1 rounded-lg p-4 text-center">
						<div class="text-3xl font-bold text-accent mb-1">
							{{ statsData.playlist.itemsWithCountry }}
						</div>
						<div class="text-sm text-primary-3">Songs with Country Data</div>
					</div>
					<div class="bg-primary-1 rounded-lg p-4 text-center">
						<div class="text-3xl font-bold text-accent mb-1">
							{{
								getPercentage(
									statsData.playlist.itemsWithCountry,
									statsData.playlist.items,
								)
							}}%
						</div>
						<div class="text-sm text-primary-3">Coverage</div>
					</div>
				</div>
				<div>
					<h3 class="text-lg font-semibold mb-4">Songs by Country</h3>
					<div class="space-y-2">
						<div
							v-for="country in statsData.playlist.topCountries"
							:key="country.country"
							class="flex items-center gap-3"
						>
							<div
								class="w-32 text-sm text-primary-3 truncate flex items-center gap-2"
							>
								<span :title="country.country">
									{{ getFlagEmoji(country.country) }}
								</span>
								<span>{{ country.country }}</span>
							</div>
							<div
								class="flex-1 relative h-7 bg-primary-1 rounded-lg overflow-hidden"
							>
								<div
									class="absolute inset-y-0 left-0 bg-accent transition-all duration-500 flex items-center justify-end pr-2"
									:style="{
										width: getBarWidth(
											country.count,
											statsData.playlist.topCountries[0]?.count || 1,
										),
									}"
								>
									<span class="text-xs font-semibold text-primary-1">
										{{ country.count }}
									</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			<!-- Release Date Statistics Section -->
			<section class="bg-bg-gradient rounded-lg p-6">
				<h2 class="text-2xl font-semibold mb-6 flex items-center gap-2">
					<div class="i-mdi-calendar" />
					Release Date Statistics
				</h2>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
					<div class="bg-primary-1 rounded-lg p-4 text-center">
						<div class="text-3xl font-bold text-accent mb-1">
							{{ statsData.playlist.itemsWithReleaseDate }}
						</div>
						<div class="text-sm text-primary-3">Songs with Release Date</div>
					</div>
					<div class="bg-primary-1 rounded-lg p-4 text-center">
						<div class="text-3xl font-bold text-accent mb-1">
							{{
								getPercentage(
									statsData.playlist.itemsWithReleaseDate,
									statsData.playlist.items,
								)
							}}%
						</div>
						<div class="text-sm text-primary-3">Coverage</div>
					</div>
				</div>
				<div>
					<h3 class="text-lg font-semibold mb-4">Songs by Release Year</h3>
					<div class="space-y-2">
						<div
							v-for="yearData in statsData.playlist.releaseYears"
							:key="yearData.year"
							class="flex items-center gap-3"
						>
							<div class="w-20 text-sm text-primary-3">
								{{ yearData.year }}
							</div>
							<div
								class="flex-1 relative h-7 bg-primary-1 rounded-lg overflow-hidden"
							>
								<div
									class="absolute inset-y-0 left-0 bg-accent transition-all duration-500 flex items-center justify-end pr-2"
									:style="{
										width: getBarWidth(
											yearData.count,
											Math.max(
												...statsData.playlist.releaseYears.map((y) => y.count),
											),
										),
									}"
								>
									<span class="text-xs font-semibold text-primary-1">
										{{ yearData.count }}
									</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			<!-- Posts Per Year Section -->
			<section class="bg-bg-gradient rounded-lg p-6">
				<h2 class="text-2xl font-semibold mb-6 flex items-center gap-2">
					<div class="i-mdi-calendar-clock" />
					Posts Per Year
				</h2>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
					<div class="bg-primary-1 rounded-lg p-4 text-center">
						<div class="text-3xl font-bold text-accent mb-1">
							{{
								statsData.playlist.postsPerYear.reduce(
									(sum, year) => sum + year.count,
									0,
								)
							}}
						</div>
						<div class="text-sm text-primary-3">Total Posts</div>
					</div>
					<div class="bg-primary-1 rounded-lg p-4 text-center">
						<div class="text-3xl font-bold text-accent mb-1">
							{{ statsData.playlist.postsPerYear.length }}
						</div>
						<div class="text-sm text-primary-3">Years Active</div>
					</div>
				</div>
				<div>
					<h3 class="text-lg font-semibold mb-4">Posts by Year</h3>
					<div class="space-y-2">
						<div
							v-for="yearData in statsData.playlist.postsPerYear"
							:key="yearData.year"
							class="flex items-center gap-3"
						>
							<div class="w-20 text-sm text-primary-3">
								{{ yearData.year }}
							</div>
							<div
								class="flex-1 relative h-7 bg-primary-1 rounded-lg overflow-hidden"
							>
								<div
									class="absolute inset-y-0 left-0 bg-accent transition-all duration-500 flex items-center justify-end pr-2"
									:style="{
										width: getBarWidth(
											yearData.count,
											Math.max(
												...statsData.playlist.postsPerYear.map((y) => y.count),
											),
										),
									}"
								>
									<span class="text-xs font-semibold text-primary-1">
										{{ yearData.count }}
									</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>
		</div>
	</div>
</template>

<script setup lang="ts">
interface Source {
	url: string;
	name: string;
	summary: string;
	items?: number;
	tags?: number;
}

interface PlaylistData {
	items: number;
	itemsWithTags: number;
	itemsWithExternalIds: number;
	externalIdsByPlatform: Record<string, number>;
	topTags: Array<{ tag: string; count: number }>;
	topTagsByUser: Record<
		string,
		{
			tags: Array<{ tag: string; count: number }>;
			totalSongs: number;
		}
	>;
	itemsWithCountry: number;
	topCountries: Array<{ country: string; count: number }>;
	itemsWithReleaseDate: number;
	releaseYears: Array<{ year: string; count: number }>;
	postsPerYear: Array<{ year: string; count: number }>;
}

interface FileExtensionStats {
	count: number;
	lines: number;
	size: number;
}

interface RepositoryStats {
	project: {
		name: string;
		type: string;
		dependencies: number;
		devDependencies: number;
	};
	files: {
		totalFiles: number;
		totalLines: number;
		totalSize: number;
		extensions: Record<string, FileExtensionStats>;
	};
	components: {
		total: number;
		admin: number;
		app: number;
		pages: number;
		layouts: number;
	};
	api: {
		total: number;
		musicbrainz: number;
		playlists: number;
		songs: number;
	};
	songs: {
		total: number;
		totalSize: number;
	};
	playlists: {
		total: number;
	};
	codeQuality: {
		hasTypeScript: boolean;
		hasESLint: boolean;
		hasTests: boolean;
		testCoverage: string;
	};
}

interface StatsData {
	sources: Record<string, Source>;
	playlist: PlaylistData;
	repository?: RepositoryStats;
}

// Page metadata
useHead({
	title: "Statistics - Music Playlist View",
	meta: [
		{ name: "description", content: "View statistics about your music data" },
	],
});

// Reactive data
const loading = ref(true);
const error = ref<string>("");
const statsData = ref<StatsData>({
	sources: {},
	playlist: {
		items: 0,
		itemsWithTags: 0,
		itemsWithExternalIds: 0,
		externalIdsByPlatform: {},
		topTags: [],
		topTagsByUser: {},
		itemsWithCountry: 0,
		topCountries: [],
		itemsWithReleaseDate: 0,
		releaseYears: [],
		postsPerYear: [],
	},
});

// Load stats data on mount
onMounted(async () => {
	try {
		loading.value = true;
		const data = await $fetch<StatsData>("/stats/sources.json");
		statsData.value = data;
	} catch (err: any) {
		console.error("Error loading stats:", err);
		error.value = "Failed to load statistics data";
	} finally {
		loading.value = false;
	}
});

// Computed properties for data sources
const sortedSources = computed(() => {
	return Object.entries(statsData.value.sources)
		.filter(([_, source]) => source.items && source.items > 0)
		.map(([key, source]) => ({ key, ...source }))
		.sort((a, b) => (b.items || 0) - (a.items || 0));
});

const maxSourceItems = computed(() => {
	return Math.max(
		...Object.values(statsData.value.sources)
			.map((s) => s.items || 0)
			.filter((n) => n > 0),
		1,
	);
});

// Computed properties for playlist
const playlistTagsPercentage = computed(() => {
	const total = statsData.value.playlist.items;
	const withTags = statsData.value.playlist.itemsWithTags;
	return total > 0 ? ((withTags / total) * 100).toFixed(1) : "0";
});

const playlistExternalIdsPercentage = computed(() => {
	const total = statsData.value.playlist.items;
	const withExternalIds = statsData.value.playlist.itemsWithExternalIds;
	return total > 0 ? ((withExternalIds / total) * 100).toFixed(1) : "0";
});

const sortedPlaylistPlatforms = computed(() => {
	return Object.entries(statsData.value.playlist.externalIdsByPlatform)
		.map(([key, count]) => ({ key, count }))
		.sort((a, b) => b.count - a.count);
});

const sortedUsers = computed(() => {
	return Object.entries(statsData.value.playlist.topTagsByUser)
		.sort(([, a], [, b]) => b.totalSongs - a.totalSongs)
		.map(([userId]) => userId);
});

const maxTagCount = computed(() => {
	return Math.max(...statsData.value.playlist.topTags.map((t) => t.count), 1);
});

// Repository stats computed properties
const topFileTypes = computed(() => {
	if (!statsData.value.repository) return [];
	return Object.entries(statsData.value.repository.files.extensions)
		.map(([ext, data]) => ({ ext, ...data }))
		.sort((a, b) => b.count - a.count)
		.slice(0, 10);
});

const maxFileCount = computed(() => {
	if (!statsData.value.repository || !topFileTypes.value.length) return 1;
	return Math.max(...topFileTypes.value.map((f) => f.count));
});

const componentBreakdown = computed(() => {
	if (!statsData.value.repository) return [];
	const repo = statsData.value.repository;
	return [
		{ name: "Admin", count: repo.components.admin },
		{ name: "App", count: repo.components.app },
		{ name: "Pages", count: repo.components.pages },
		{ name: "Layouts", count: repo.components.layouts },
	];
});

const apiBreakdown = computed(() => {
	if (!statsData.value.repository) return [];
	const repo = statsData.value.repository;
	return [
		{ name: "Playlists", count: repo.api.playlists },
		{ name: "MusicBrainz", count: repo.api.musicbrainz },
		{ name: "Songs", count: repo.api.songs },
	];
});

const getTagBarColor = (count: number, max: number): string => {
	const percentage = max > 0 ? count / max : 0;
	// Create gradient from dim to full accent based on count
	if (percentage > 0.7) return "bg-accent";
	if (percentage > 0.4) return "bg-accent-1";
	return "bg-accent-2";
};

// Helper functions
const getBarWidth = (value: number, max: number): string => {
	const percentage = max > 0 ? (value / max) * 100 : 0;
	return `${Math.max(percentage, 2)}%`; // Minimum 2% for visibility
};

const getPercentage = (value: number, total: number): string => {
	return total > 0 ? ((value / total) * 100).toFixed(1) : "0";
};

const formatPlatformName = (key: string): string => {
	// Convert camelCase to Title Case with spaces
	const formatted = key
		.replace(/([A-Z])/g, " $1")
		.replace(/^./, (str) => str.toUpperCase())
		.trim();

	// Special cases
	const specialCases: Record<string, string> = {
		Lastfm: "Last.fm",
		Youtube: "YouTube",
		"Youtube Music": "YouTube Music",
		Itunes: "iTunes",
		"Amazon Music": "Amazon Music",
		"Amazon Store": "Amazon Store",
		"Apple Music": "Apple Music",
		"Musicbrainz Track": "MusicBrainz Track",
		"Musicbrainz Artist": "MusicBrainz Artist",
	};

	return specialCases[formatted] || formatted;
};

// Convert country code to flag emoji
const getFlagEmoji = (countryCode: string): string => {
	if (!countryCode || countryCode.length !== 2) return "";
	const codePoints = countryCode
		.toUpperCase()
		.split("")
		.map((char) => 127397 + char.charCodeAt(0));
	return String.fromCodePoint(...codePoints);
};

// Format large numbers with thousand separators
const formatNumber = (num: number): string => {
	return num.toLocaleString();
};

// Format bytes to human-readable format
const formatFileSize = (bytes: number): string => {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};
</script>
